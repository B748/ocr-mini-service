import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { TesseractService } from './tesseract.service';
import { nanoid } from '../types/nanoid.function';

interface MessageEvent {
  data: string;
}

@Injectable()
export class OcrService {
  private _processing = false;

  constructor(private readonly tesseractService: TesseractService) {}

  isProcessing(): boolean {
    return this._processing;
  }

  async startOcrProcess(file: any): Promise<string> {
    const jobId = nanoid();
    const progressSubject = new Subject<MessageEvent>();

    this._processing = true;

    // Start OCR processing in background
    void this._processOcrAsync(jobId, file, progressSubject);

    return jobId;
  }

  async getDebugInfo() {
    return this.tesseractService.getDebugInfo();
  }

  private async _processOcrAsync(
    jobId: string,
    file: any,
    progressSubject: Subject<MessageEvent>,
  ) {
    try {
      // PROCESS IMAGE WITH TESSERACT
      const result = await this.tesseractService.processImage(file.buffer);

      // SEND COMPLETION
      this._sendSse(progressSubject, {
        type: 'complete',
        result,
      });
    } catch (error) {
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