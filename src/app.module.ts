import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { OcrModule } from './ocr/ocr.module';

@Module({
  imports: [CommonModule, OcrModule],
})
export class AppModule {}