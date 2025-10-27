import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VersionService } from '../common/version.service';
import { OcrService } from './ocr.service';
import { Express } from 'express';
import 'multer';

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

    const jobId = await this._ocrService.startOcrProcess(file);

    return {
      jobId,
      message: 'OCR processing started',
      progressUrl: `/ocr/progress/${jobId}`,
    };
  }

  @Post('process-buffer')
  async processBuffer(@Req() req: Request) {
    this._logger.debug('Processing buffer request...');

    const buffer = (req as any).rawBody as Buffer;

    if (!buffer || buffer.length === 0) {
      this._logger.error('No Data in buffer');
      throw new BadRequestException('Empty body');
    }

    if (buffer.length > 10 * 1024 * 1024) {
      this._logger.error('Buffer exceeds 10MB');
      throw new BadRequestException('File too large');
    }

    this._logger.debug('Starting OCR process...');

    return {
      jobId,
      message: `OCR processing started (buffer mode). Get Result via /ocr/progress/${jobId}`,
    };
  }
}
