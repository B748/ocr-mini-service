import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { OcrService } from './ocr.service';
import { CodeReaderService } from './code-reader.service';
import { nanoid } from '../types/nanoid.function';
import {
  JobStatus,
  ReturnStrategy,
  WebhookPayload,
} from '../types/return-strategy.types';
import { response } from 'express';
import { OcrProcessResult, DimensionData, TextContent, DataContent } from '../types/ocr.types';
import { promises as fs } from 'fs';
import { join } from 'path';

interface MessageEvent {
  data: string;
}

@Injectable()
export class ImageRecognitionService {
  private readonly _logger = new Logger(ImageRecognitionService.name);
  private _processing = false;
  private _progressStreams = new Map<string, Subject<MessageEvent>>();
  private _jobStatuses = new Map<string, JobStatus>();
  private readonly _tempDir =
    process.env.TESSERACT_TEMP_DIR || '/tmp/tesseract-api';

  constructor(
    private readonly tesseractService: OcrService,
    private readonly codeReaderService: CodeReaderService,
  ) {}

  /**
   * Checks if the OCR service is currently processing a request
   * @returns True if processing is in progress, false otherwise
   */
  isProcessing(): boolean {
    return this._processing;
  }

  /**
   * Starts OCR processing on a buffer with specified return strategy
   * @param buffer - Image buffer to process
   * @param returnStrategy - How to return results: 'sse', 'webhook', or 'polling'
   * @param webhookUrl - Optional webhook URL for webhook strategy
   * @param callbackHeaders - Optional headers for webhook callbacks
   * @returns Promise resolving to unique job ID
   */
  async startImageRecognitionOnBuffer(
    buffer: Buffer,
    returnStrategy: ReturnStrategy = 'sse',
    webhookUrl?: string,
    callbackHeaders?: Record<string, string>,
  ): Promise<string> {
    this._logger.debug('Starting OCR process...');
    const jobId = nanoid();

    // INITIALIZE JOB STATUS
    const jobStatus: JobStatus = {
      jobId,
      status: 'processing',
      createdAt: new Date(),
    };
    this._jobStatuses.set(jobId, jobStatus);

    // SETUP SSE STREAM IF NEEDED
    if (returnStrategy === 'sse') {
      const progressSubject = new Subject<MessageEvent>();
      this._progressStreams.set(jobId, progressSubject);
    }

    this._processing = true;

    // START OCR PROCESSING IN BACKGROUND
    void this._processImageAsync(
      jobId,
      buffer,
      returnStrategy,
      webhookUrl,
      callbackHeaders,
    );

    this._logger.debug(
      `OCR-job created: ${jobId} with strategy: ${returnStrategy}`,
    );
    return jobId;
  }

  /**
   * Gets debug information from the Tesseract service
   * @returns Debug information including system state and configuration
   */
  async getDebugInfo() {
    return this.tesseractService.getDebugInfo();
  }

  /**
   * Writes image buffer to a temporary file
   * @param imageBuffer - The image data to write
   * @param inputPath - Path where the file should be written
   * @returns Promise that resolves when file is written successfully
   * @throws {Error} When file cannot be written to temp directory
   * @private
   */
  private async _writeBufferToTempFile(
    imageBuffer: Buffer,
    inputPath: string,
  ): Promise<void> {
    try {
      await fs.writeFile(inputPath, imageBuffer);
      this._logger.debug(
        `Created input file: ${inputPath} (${imageBuffer.length} bytes)`,
      );
    } catch (writeError: any) {
      this._logger.error(
        `Failed to write input file to ${inputPath}:`,
        writeError,
      );

      // CHECK DIRECTORY PERMISSIONS
      try {
        const stats = await fs.stat(this._tempDir);
        this._logger.error(
          `Temp directory permissions: ${stats.mode.toString(8)}`,
        );
      } catch (statError) {
        this._logger.error(`Cannot stat temp directory: ${statError.message}`);
      }

      throw new Error(`Cannot write to temp directory: ${writeError.message}`);
    }
  }

  /**
   * Processes OCR asynchronously and handles different return strategies
   * @param jobId - Unique job identifier
   * @param buffer - Image buffer to process
   * @param returnStrategy - How to return results
   * @param webhookUrl - Optional webhook URL
   * @param callbackHeaders - Optional webhook headers
   * @private
   */
  private async _processImageAsync(
    jobId: string,
    buffer: Buffer,
    returnStrategy: ReturnStrategy,
    webhookUrl?: string,
    callbackHeaders?: Record<string, string>,
  ) {
    const progressSubject = this._progressStreams.get(jobId);
    const inputPath = join(this._tempDir, `input_${jobId}.png`);

    try {
      // WRITE BUFFER TO TEMP FILE
      await this._writeBufferToTempFile(buffer, inputPath);

      // PROCESS IMAGE WITH BOTH TESSERACT AND ZBAR IN PARALLEL
      const [textResults, codes] = await Promise.all([
        this.tesseractService.processImage(inputPath).catch((error) => {
          this._logger.warn(`OCR processing failed: ${error.message}`);
          return []; // CONTINUE EVEN IF OCR FAILS
        }),
        this.codeReaderService.processImage(inputPath).catch((error) => {
          this._logger.warn(`ZBar processing failed: ${error.message}`);
          return []; // CONTINUE EVEN IF ZBAR FAILS
        }),
      ]);

      // FILTER OUT OCR TEXT THAT OVERLAPS WITH DETECTED CODES
      const filteredTextResults = this._filterOverlappingText(textResults, codes);

      // COMBINE RESULTS
      const result: OcrProcessResult = {
        words: filteredTextResults,
        codes,
      };

      this._logger.debug(
        `OCR-job done: ${jobId} (${filteredTextResults.length}/${textResults.length} words, ${codes.length} codes)`,
      );

      // UPDATE JOB STATUS
      const jobStatus = this._jobStatuses.get(jobId);
      if (jobStatus) {
        jobStatus.status = 'completed';
        jobStatus.result = result;
        jobStatus.completedAt = new Date();
      }

      // HANDLE DIFFERENT RETURN STRATEGIES
      await this._handleCompletion(
        jobId,
        returnStrategy,
        result,
        webhookUrl,
        callbackHeaders,
        progressSubject,
      );
    } catch (error) {
      this._logger.error(`OCR-job failed: ${jobId}`, error);

      // UPDATE JOB STATUS
      const jobStatus = this._jobStatuses.get(jobId);
      if (jobStatus) {
        jobStatus.status = 'failed';
        jobStatus.error = error.message || 'OCR processing failed';
        jobStatus.completedAt = new Date();
      }

      // HANDLE DIFFERENT RETURN STRATEGIES FOR ERRORS
      await this._handleError(
        jobId,
        returnStrategy,
        error.message || 'OCR processing failed',
        webhookUrl,
        callbackHeaders,
        progressSubject,
      );
    } finally {
      this._processing = false;
      if (progressSubject) {
        progressSubject.complete();
      }

      // CLEANUP INPUT FILE
      try {
        await fs.unlink(inputPath);
        this._logger.debug(`Cleaned up input file: ${inputPath}`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          this._logger.warn(
            `Failed to cleanup input file ${inputPath}: ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Filters out OCR text results that overlap with detected codes
   * @param textResults - Array of OCR text results
   * @param codes - Array of detected codes (barcodes/QR codes)
   * @returns Filtered array of text results with overlapping text removed
   * @private
   */
  private _filterOverlappingText(
    textResults: DimensionData<TextContent>[],
    codes: DimensionData<DataContent>[],
  ): DimensionData<TextContent>[] {
    if (codes.length === 0) {
      return textResults; // NO CODES DETECTED, RETURN ALL TEXT
    }

    const filteredResults = textResults.filter((textResult) => {
      // CHECK IF THIS TEXT OVERLAPS WITH ANY CODE
      const overlapsWithCode = codes.some((code) =>
        this._rectanglesOverlap(textResult, code),
      );
      return !overlapsWithCode; // KEEP TEXT THAT DOESN'T OVERLAP
    });

    const removedCount = textResults.length - filteredResults.length;
    if (removedCount > 0) {
      this._logger.debug(
        `Filtered out ${removedCount} OCR text results that overlapped with codes`,
      );
    }

    return filteredResults;
  }

  /**
   * Checks if two rectangles overlap
   * @param rect1 - First rectangle with normalized coordinates (0-1)
   * @param rect2 - Second rectangle with normalized coordinates (0-1)
   * @returns True if rectangles overlap, false otherwise
   * @private
   */
  private _rectanglesOverlap(
    rect1: DimensionData<any>,
    rect2: DimensionData<any>,
  ): boolean {
    const rect1Right = rect1.left + rect1.width;
    const rect1Bottom = rect1.top + rect1.height;
    const rect2Right = rect2.left + rect2.width;
    const rect2Bottom = rect2.top + rect2.height;

    // RECTANGLES DON'T OVERLAP IF ONE IS COMPLETELY TO THE LEFT, RIGHT, ABOVE, OR BELOW THE OTHER
    const noOverlap =
      rect1Right <= rect2.left || // RECT1 IS TO THE LEFT OF RECT2
      rect2Right <= rect1.left || // RECT2 IS TO THE LEFT OF RECT1
      rect1Bottom <= rect2.top || // RECT1 IS ABOVE RECT2
      rect2Bottom <= rect1.top; // RECT2 IS ABOVE RECT1

    return !noOverlap;
  }

  /**
   * Sends data through Server-Sent Events stream
   * @param progressSubject - The SSE subject to send data through
   * @param data - Data to send via SSE
   * @private
   */
  private _sendSse(progressSubject: Subject<MessageEvent>, data: unknown) {
    progressSubject.next({ data: JSON.stringify(data) });
  }

  /**
   * Gets the progress stream for a specific job
   * @param jobId - The unique job identifier
   * @returns Observable stream of progress events
   * @throws {NotFoundException} When job ID is not found
   */
  getProgressStream(jobId: string): Observable<MessageEvent> {
    const progressSubject = this._progressStreams.get(jobId);
    if (!progressSubject) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return progressSubject.asObservable();
  }

  /**
   * Gets the current status of a specific job
   * @param jobId - The unique job identifier
   * @returns Current job status information
   * @throws {NotFoundException} When job ID is not found
   */
  getJobStatus(jobId: string): JobStatus {
    const jobStatus = this._jobStatuses.get(jobId);
    if (!jobStatus) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return jobStatus;
  }

  /**
   * Handles successful completion of OCR processing based on return strategy
   * @param jobId - The unique job identifier
   * @param returnStrategy - How to return results
   * @param result - The OCR processing result
   * @param webhookUrl - Optional webhook URL
   * @param callbackHeaders - Optional webhook headers
   * @param progressSubject - Optional SSE subject
   * @private
   */
  private async _handleCompletion(
    jobId: string,
    returnStrategy: ReturnStrategy,
    result: any,
    webhookUrl?: string,
    callbackHeaders?: Record<string, string>,
    progressSubject?: Subject<MessageEvent>,
  ) {
    switch (returnStrategy) {
      case 'sse':
        if (progressSubject) {
          this._sendSse(progressSubject, {
            type: 'complete',
            result,
          });
        }
        break;
      case 'webhook':
        if (webhookUrl) {
          await this._sendWebhook(
            jobId,
            'completed',
            webhookUrl,
            callbackHeaders,
            result,
          );
        }
        break;
      case 'polling':
        // STATUS IS ALREADY UPDATED IN JOB STATUS MAP
        this._logger.debug(`Job ${jobId} completed, available for polling`);
        break;
    }
  }

  /**
   * Handles OCR processing errors based on return strategy
   * @param jobId - The unique job identifier
   * @param returnStrategy - How to return results
   * @param error - The error message
   * @param webhookUrl - Optional webhook URL
   * @param callbackHeaders - Optional webhook headers
   * @param progressSubject - Optional SSE subject
   * @private
   */
  private async _handleError(
    jobId: string,
    returnStrategy: ReturnStrategy,
    error: string,
    webhookUrl?: string,
    callbackHeaders?: Record<string, string>,
    progressSubject?: Subject<MessageEvent>,
  ) {
    switch (returnStrategy) {
      case 'sse':
        if (progressSubject) {
          this._sendSse(progressSubject, {
            type: 'error',
            error,
          });
        }
        break;

      case 'webhook':
        if (webhookUrl) {
          await this._sendWebhook(
            jobId,
            'failed',
            webhookUrl,
            callbackHeaders,
            undefined,
            error,
          );
        }
        break;

      case 'polling':
        // STATUS IS ALREADY UPDATED IN JOB STATUS MAP
        this._logger.debug(`Job ${jobId} failed, available for polling`);
        break;
    }
  }

  /**
   * Sends webhook notification for job completion or failure
   * @param jobId - The unique job identifier
   * @param status - Job completion status
   * @param webhookUrl - Target webhook URL
   * @param headers - Optional custom headers
   * @param result - Optional result data for completed jobs
   * @param error - Optional error message for failed jobs
   * @private
   */
  private async _sendWebhook(
    jobId: string,
    status: 'completed' | 'failed',
    webhookUrl: string,
    headers?: Record<string, string>,
    result?: any,
    error?: string,
  ) {
    try {
      const payload: WebhookPayload = {
        jobId,
        status,
        result,
        error,
        timestamp: new Date(),
      };

      const response = await fetch(`${webhookUrl}/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this._logger.warn(
          `Webhook failed "${webhookUrl}/${jobId}": ${response.status} ${response.statusText}`,
        );
      } else {
        this._logger.debug(`Webhook sent successfully for job ${jobId}`);
      }
    } catch (error) {
      console.log(response.statusCode);
      this._logger.error(`Webhook failed "${webhookUrl}/${jobId}":`, error);
    }
  }
}
