import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VersionService } from '../common/version.service';
import { OcrService } from './ocr.service';

@Controller('ocr')
export class OcrController {
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
  async processImage(@UploadedFile() file: any) {
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
    const chunks: Buffer[] = [];

    for await (const chunk of req as any) {
      chunks.push(chunk as Buffer);
    }

    const completeBuffer = Buffer.concat(chunks);

    if (completeBuffer.length === 0) {
      throw new BadRequestException('Empty body');
    }

    if (completeBuffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('File too large');
    }

    const jobId = await this._ocrService.startOcrProcess(completeBuffer);

    return {
      jobId,
      message: 'OCR processing started (buffer mode). Get Result via /ocr/progress/{jobId}',
    };
  }
}
