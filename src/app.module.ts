import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { ImageRecognitionModule } from './ocr/image-recognition.module';

@Module({
  imports: [CommonModule, ImageRecognitionModule],
})
export class AppModule {}