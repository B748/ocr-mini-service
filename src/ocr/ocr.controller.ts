import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VersionService } from '../common/version.service';
import { OcrService } from './ocr.service';
import { Express } from 'express';
import 'multer';
import { Readable } from 'node:stream';
import { Observable } from 'rxjs';
import { ReturnStrategy } from '../types/return-strategy.types';

@Controller('ocr')
export class OcrController {
  private _logger = new Logger(OcrController.name);

  constructor(
    private readonly _ocrService: OcrService,
    private readonly _versionService: VersionService,
  ) {}

  /**
   * Gets the current status of the OCR service
   * @returns Service status information including version, processing state, and runtime info
   */
  @Get('status')
  getStatus() {
    return {
      service: 'tesseract-api',
      version: this._versionService.getVersion(),
      status: 'ready',
      processing: this._ocrService.isProcessing(),
      runtime: this._versionService.getRuntimeInfo(),
    };
  }

  /**
   * Gets version and runtime information
   * @returns Runtime information including Node.js version and system details
   */
  @Get('version')
  getVersion() {
    return this._versionService.getRuntimeInfo();
  }

  /**
   * Gets debug information from the OCR service
   * @returns Debug information including Tesseract configuration and system state
   */
  @Get('debug')
  async getDebugInfo() {
    return this._ocrService.getDebugInfo();
  }

  /**
   * Processes an uploaded image file for OCR text extraction
   * @param file - The uploaded image file (JPEG/PNG, max 10MB)
   * @param returnStrategy - How to return results: 'sse', 'webhook', or 'polling'
   * @param webhookUrl - Required webhook URL when using webhook return strategy
   * @param body - Optional request body containing callback headers
   * @returns Job information with appropriate URLs based on return strategy
   * @throws {BadRequestException} When file is missing, invalid format, too large, or service is busy
   */
  @Post('process')
  @UseInterceptors(FileInterceptor('image'))
  async processImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('returnStrategy') returnStrategy: ReturnStrategy = 'sse',
    @Query('webhookUrl') webhookUrl?: string,
    @Body() body?: { callbackHeaders?: Record<string, string> },
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size must be less than 10MB');
    }

    if (this._ocrService.isProcessing()) {
      throw new BadRequestException(
        'OCR service is busy, please try again later',
      );
    }

    // VALIDATE RETURN STRATEGY
    if (!['sse', 'webhook', 'polling'].includes(returnStrategy)) {
      throw new BadRequestException(
        'Invalid return strategy. Must be: sse, webhook, or polling',
      );
    }

    // VALIDATE WEBHOOK REQUIREMENTS
    if (returnStrategy === 'webhook' && !webhookUrl) {
      throw new BadRequestException(
        'webhookUrl is required when using webhook return strategy',
      );
    }

    const jobId = await this._ocrService.startOcrProcessOnBuffer(
      file.buffer,
      returnStrategy,
      webhookUrl,
      body?.callbackHeaders,
    );

    const response: any = {
      jobId,
      message: 'OCR processing started',
      returnStrategy,
    };

    // ADD APPROPRIATE URLS BASED ON RETURN STRATEGY
    switch (returnStrategy) {
      case 'sse':
        response.progressUrl = `/ocr/progress/${jobId}`;
        break;
      case 'polling':
        response.statusUrl = `/ocr/status/${jobId}`;
        break;
      case 'webhook':
        response.webhookUrl = webhookUrl;
        break;
    }

    return response;
  }

  /**
   * Processes raw image buffer data for OCR text extraction
   * @param req - HTTP request containing raw image buffer in body
   * @param returnStrategy - How to return results: 'sse', 'webhook', or 'polling'
   * @param webhookUrl - Required webhook URL when using webhook return strategy
   * @param callbackHeaders - Optional JSON string of headers for webhook callbacks
   * @returns Job information with appropriate URLs based on return strategy
   * @throws {BadRequestException} When buffer is empty, too large, invalid format, or service is busy
   */
  @Post('process-buffer')
  async processBuffer(
    @Req() req: Request,
    @Query('returnStrategy') returnStrategy: ReturnStrategy = 'sse',
    @Query('webhookUrl') webhookUrl?: string,
    @Query('callbackHeaders') callbackHeaders?: string,
  ) {
    this._logger.debug('Processing buffer request...');

    const stream = req as unknown as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }

    const buffer = Buffer.concat(chunks);

    this._logger.debug(`Received buffer with length: ${buffer.length}`);

    if (!buffer || buffer.length === 0) {
      this._logger.error('No Data in buffer');
      throw new BadRequestException('Empty body');
    }

    if (buffer.length > 10 * 1024 * 1024) {
      this._logger.error('Buffer exceeds 10MB');
      throw new BadRequestException('File too large');
    }

    if (this._ocrService.isProcessing()) {
      throw new BadRequestException(
        'OCR service is busy, please try again later',
      );
    }

    // VALIDATE RETURN STRATEGY
    if (!['sse', 'webhook', 'polling'].includes(returnStrategy)) {
      throw new BadRequestException(
        'Invalid return strategy. Must be: sse, webhook, or polling',
      );
    }

    // VALIDATE WEBHOOK REQUIREMENTS
    if (returnStrategy === 'webhook' && !webhookUrl) {
      throw new BadRequestException(
        'webhookUrl is required when using webhook return strategy',
      );
    }

    // PARSE CALLBACK HEADERS IF PROVIDED
    let parsedHeaders: Record<string, string> | undefined;
    if (callbackHeaders) {
      try {
        parsedHeaders = JSON.parse(callbackHeaders);
      } catch (error) {
        throw new BadRequestException(
          'Invalid callbackHeaders format. Must be valid JSON.',
        );
      }
    }

    const jobId = await this._ocrService.startOcrProcessOnBuffer(
      buffer,
      returnStrategy,
      webhookUrl,
      parsedHeaders,
    );

    const response: any = {
      jobId,
      message: 'OCR processing started (buffer mode)',
      returnStrategy,
    };

    // ADD APPROPRIATE URLS BASED ON RETURN STRATEGY
    switch (returnStrategy) {
      case 'sse':
        response.progressUrl = `/ocr/progress/${jobId}`;
        break;
      case 'polling':
        response.statusUrl = `/ocr/status/${jobId}`;
        break;
      case 'webhook':
        response.webhookUrl = webhookUrl;
        break;
    }

    return response;
  }

  /**
   * Provides Server-Sent Events stream for OCR processing progress
   * @param jobId - The unique job identifier for the OCR processing task
   * @returns Observable stream of progress events for the specified job
   */
  @Sse('progress/:jobId')
  getProgress(@Param('jobId') jobId: string): Observable<any> {
    this._logger.debug(`SSE request for job ${jobId}`);
    return this._ocrService.getProgressStream(jobId);
  }

  /**
   * Gets the current status of a specific OCR processing job
   * @param jobId - The unique job identifier for the OCR processing task
   * @returns Current job status including progress, completion state, and results if available
   */
  @Get('status/:jobId')
  getJobStatus(@Param('jobId') jobId: string) {
    this._logger.debug(`Status request for job ${jobId}`);
    return this._ocrService.getJobStatus(jobId);
  }
}
