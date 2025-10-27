import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { TesseractService } from './tesseract.service';
import { nanoid } from '../types/nanoid.function';

interface MessageEvent {
  data: string;
}

@Injectable()
export class OcrService {
  private readonly _logger = new Logger(OcrService.name);
  private _processing = false;

  constructor(private readonly tesseractService: TesseractService) {}

  isProcessing(): boolean {
    return this._processing;
  }

  async startOcrProcessOnBuffer(buffer: Buffer): Promise<string> {
    this._logger.debug('Starting OCR process...');
    const jobId = nanoid();
    const progressSubject = new Subject<MessageEvent>();

    this._processing = true;

    // Start OCR processing in background
    void this._processOcrAsync(jobId, buffer, progressSubject);

    this._logger.debug(`OCR-job created: ${jobId}`);
    return jobId;
  }

  async getDebugInfo() {
    return this.tesseractService.getDebugInfo();
  }

  private async _processOcrAsync(
    jobId: string,
    buffer: Buffer,
    progressSubject: Subject<MessageEvent>,
  ) {
    try {
      // PROCESS IMAGE WITH TESSERACT
      const result = await this.tesseractService.processImage(buffer);

      this._logger.debug(`OCR-job done: ${jobId}`);

      // SEND COMPLETION
      this._sendSse(progressSubject, {
        type: 'complete',
        result,
      });
    } catch (error) {
      this._logger.error(`OCR-job failed: ${jobId}`);

      this._sendSse(progressSubject, {
        type: 'error',
        error: error.message || 'OCR processing failed',
      });
    } finally {
      this._processing = false;
      progressSubject.complete();
    }
  }

  private _sendSse(progressSubject: Subject<MessageEvent>, data: unknown) {
    progressSubject.next({ data: JSON.stringify(data) });
  }
}