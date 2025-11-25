import { Module } from '@nestjs/common';
import { ImageRecognitionController } from './image-recognition.controller';
import { ImageRecognitionService } from './image-recognition.service';
import { OcrService } from './ocr.service';
import { CodeReaderService } from './code-reader.service';

@Module({
  controllers: [ImageRecognitionController],
  providers: [ImageRecognitionService, OcrService, CodeReaderService],
})
export class ImageRecognitionModule {}