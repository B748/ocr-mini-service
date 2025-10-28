import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { TesseractService } from './tesseract.service';
import { nanoid } from '../types/nanoid.function';
import { ReturnStrategy, JobStatus, WebhookPayload } from '../types/return-strategy.types';

interface MessageEvent {
  data: string;
}

@Injectable()
export class OcrService {
  private readonly _logger = new Logger(OcrService.name);
  private _processing = false;
  private _progressStreams = new Map<string, Subject<MessageEvent>>();
  private _jobStatuses = new Map<string, JobStatus>();

  constructor(private readonly tesseractService: TesseractService) {}

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
  async startOcrProcessOnBuffer(
    buffer: Buffer, 
    returnStrategy: ReturnStrategy = 'sse',
    webhookUrl?: string,
    callbackHeaders?: Record<string, string>
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
    void this._processOcrAsync(jobId, buffer, returnStrategy, webhookUrl, callbackHeaders);

    this._logger.debug(`OCR-job created: ${jobId} with strategy: ${returnStrategy}`);
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
   * Processes OCR asynchronously and handles different return strategies
   * @param jobId - Unique job identifier
   * @param buffer - Image buffer to process
   * @param returnStrategy - How to return results
   * @param webhookUrl - Optional webhook URL
   * @param callbackHeaders - Optional webhook headers
   * @private
   */
  private async _processOcrAsync(
    jobId: string,
    buffer: Buffer,
    returnStrategy: ReturnStrategy,
    webhookUrl?: string,
    callbackHeaders?: Record<string, string>
  ) {
    const progressSubject = this._progressStreams.get(jobId);
    
    try {
      // PROCESS IMAGE WITH TESSERACT
      const result = await this.tesseractService.processImage(buffer);

      this._logger.debug(`OCR-job done: ${jobId}`);

      // UPDATE JOB STATUS
      const jobStatus = this._jobStatuses.get(jobId);
      if (jobStatus) {
        jobStatus.status = 'completed';
        jobStatus.result = result;
        jobStatus.completedAt = new Date();
      }

      // HANDLE DIFFERENT RETURN STRATEGIES
      await this._handleCompletion(jobId, returnStrategy, result, webhookUrl, callbackHeaders, progressSubject);

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
      await this._handleError(jobId, returnStrategy, error.message || 'OCR processing failed', webhookUrl, callbackHeaders, progressSubject);

    } finally {
      this._processing = false;
      if (progressSubject) {
        progressSubject.complete();
      }
    }
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
    progressSubject?: Subject<MessageEvent>
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
          await this._sendWebhook(jobId, 'completed', webhookUrl, callbackHeaders, result);
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
    progressSubject?: Subject<MessageEvent>
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
          await this._sendWebhook(jobId, 'failed', webhookUrl, callbackHeaders, undefined, error);
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
    error?: string
  ) {
    try {
      const payload: WebhookPayload = {
        jobId,
        status,
        result,
        error,
        timestamp: new Date(),
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this._logger.warn(`Webhook failed for job ${jobId}: ${response.status} ${response.statusText}`);
      } else {
        this._logger.debug(`Webhook sent successfully for job ${jobId}`);
      }
    } catch (error) {
      this._logger.error(`Failed to send webhook for job ${jobId}:`, error);
    }
  }
}