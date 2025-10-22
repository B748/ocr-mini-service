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
import { OcrService } from './ocr.service';

@Controller('ocr')
export class OcrController {
  constructor(private readonly _ocrService: OcrService) {}

  @Get('status')
  getStatus() {
    return {
      service: 'tesseract-api',
      status: 'ready',
      processing: this._ocrService.isProcessing(),
    };
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

    if (req.body) {
      const reader = req.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
      }
    }

    const completeBuffer = Buffer.concat(chunks);

    if (completeBuffer.length === 0) {
      throw new BadRequestException('Empty body');
    }

    // optional: validate size or type manually
    if (completeBuffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('File too large');
    }

    const jobId = await this._ocrService.startOcrProcess(completeBuffer);

    return {
      jobId,
      message: 'OCR processing started (buffer mode)',
    };
  }
}
