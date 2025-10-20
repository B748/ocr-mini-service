import { Module } from '@nestjs/common';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { TesseractService } from './tesseract.service';

@Module({
  controllers: [OcrController],
  providers: [OcrService, TesseractService],
})
export class OcrModule {}