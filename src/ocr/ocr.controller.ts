import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Param,
  Post,
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

@Controller('ocr')
export class OcrController {
  private _logger = new Logger(OcrController.name);

  constructor(
    private readonly _ocrService: OcrService,
    private readonly _versionService: VersionService,
  ) {}

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

  @Get('version')
  getVersion() {
    return this._versionService.getRuntimeInfo();
  }

  @Get('debug')
  async getDebugInfo() {
    return this._ocrService.getDebugInfo();
  }

  @Post('process')
  @UseInterceptors(FileInterceptor('image'))
  async processImage(@UploadedFile() file: Express.Multer.File) {
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

    const jobId = await this._ocrService.startOcrProcessOnBuffer(file.buffer);

    return {
      jobId,
      message: 'OCR processing started',
      progressUrl: `/ocr/progress/${jobId}`,
    };
  }

  @Post('process-buffer')
  async processBuffer(@Req() req: Request) {
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

    const jobId = await this._ocrService.startOcrProcessOnBuffer(buffer);

    return {
      jobId,
      message: `OCR processing started (buffer mode). Get Result via /ocr/progress/${jobId}`,
    };
  }

  @Sse('progress/:jobId')
  getProgress(@Param('jobId') jobId: string): Observable<any> {
    return this._ocrService.getProgressStream(jobId);
  }
}
