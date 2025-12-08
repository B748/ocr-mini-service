import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VersionService } from '../common/version.service';
import { ImageRecognitionService } from './image-recognition.service';
import { Express } from 'express';
import 'multer';
import { Observable } from 'rxjs';
import { ReturnStrategy } from '../types/return-strategy.types';
import { Request } from 'express';

@Controller('ocr')
export class ImageRecognitionController {
  private _logger = new Logger(ImageRecognitionController.name);

  constructor(
    private readonly _ocrService: ImageRecognitionService,
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
   * @param body
   * @returns Job information with appropriate URLs based on return strategy
   * @throws {BadRequestException} When file is missing, invalid format, too large, or service is busy
   */
  @Post('process')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('image'))
  async processImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body?: {body: string},
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
      throw new ServiceUnavailableException(
        'OCR service is busy processing another request',
      );
    }

    const parsedBody: {
      returnStrategy?: ReturnStrategy;
      webhookUrl?: string;
      callbackHeaders?: Record<string, string>;
      language?: string;
    } = JSON.parse(body.body || '{}');

    // VALIDATE RETURN STRATEGY
    if (!['sse', 'webhook', 'polling'].includes(parsedBody.returnStrategy)) {
      this._logger.error('Invalid return strategy: ', parsedBody);
      throw new BadRequestException(
        'Invalid return strategy. Must be: sse, webhook, or polling',
      );
    }

    // VALIDATE WEBHOOK REQUIREMENTS
    if (parsedBody.returnStrategy === 'webhook' && !parsedBody.webhookUrl) {
      throw new BadRequestException(
        'webhookUrl is required when using webhook return strategy',
      );
    }

    const jobId = await this._ocrService.startImageRecognitionOnBuffer(
      file.buffer,
      parsedBody.returnStrategy,
      parsedBody.webhookUrl,
      parsedBody?.callbackHeaders,
      parsedBody?.language,
    );

    const response: any = {
      jobId,
      message: 'OCR processing started',
      returnStrategy: parsedBody.returnStrategy,
    };

    // ADD APPROPRIATE URLS BASED ON RETURN STRATEGY
    switch (parsedBody.returnStrategy) {
      case 'sse':
        response.progressUrl = `/ocr/progress/${jobId}`;
        break;
      case 'polling':
        response.statusUrl = `/ocr/status/${jobId}`;
        break;
      case 'webhook':
        response.webhookUrl = parsedBody.webhookUrl;
        this._logger.debug(`Webhook URL: ${parsedBody.webhookUrl}`);
        break;
    }

    return response;
  }

  /**
   * Processes raw image buffer data for OCR text extraction
   * @returns Job information with appropriate URLs based on return strategy
   * @throws {BadRequestException} When buffer is empty, too large, invalid format, or service is busy
   * @param body
   * @param req
   */
  @Post('process-buffer')
  @HttpCode(HttpStatus.ACCEPTED)
  async processBuffer(
    @Body() body: any,
    @Req() req: Request
  ) {
    const { image, options } = body;

    this._logger.log(`Received image for OCR. Decoding buffer...`);

    // CONVERT BASE64 BACK TO BUFFER
    const buffer = Buffer.from(image, 'base64');

    // COMPLETE WEBHOOK URL
    const fullWebhookUrl = body.options.webhookUrl ?
      `${req.protocol}://${req.ip}${body.options.webhookUrl}` : '';

    return this._ocrService.startImageRecognitionOnBuffer(
      buffer,
      options.returnStrategy,
      fullWebhookUrl,
      options.callbackHeaders,
      options.language,
    );
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
