import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Enable CORS for SSE
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT || 8600;
  await app.listen(port);
  
  logger.log(`Tesseract-API running on port ${port}`);
}

void bootstrap();