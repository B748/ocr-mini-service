import { Module } from '@nestjs/common';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { TesseractService } from './tesseract.service';
import { ZxingService } from './zxing.service';

@Module({
  controllers: [OcrController],
  providers: [OcrService, TesseractService, ZxingService],
})
export class OcrModule {}