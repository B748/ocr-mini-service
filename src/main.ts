import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as bodyParser from 'body-parser';

/**
 * Bootstrap function that initializes and starts the NestJS application
 * @returns Promise that resolves when the application is successfully started
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // INCREASE JSON SIZE LIMIT
  const limit = '10mb';
  app.use(bodyParser.json({ limit }));
  app.use(bodyParser.urlencoded({ limit, extended: true }));

  // ENABLE CORS FOR SSE
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT || 8600;
  await app.listen(port);
  
  logger.log(`Tesseract-API running on port ${port}`);
}

void bootstrap();