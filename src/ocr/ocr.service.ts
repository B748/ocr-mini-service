import { Injectable, NotFoundException } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { TesseractService } from './tesseract.service';
import { nanoid } from '../types/nanoid.function';

interface MessageEvent {
  data: string;
}

@Injectable()
export class OcrService {
  private _processing = false;
  private _progressStreams = new Map<string, Subject<MessageEvent>>();

  constructor(private readonly tesseractService: TesseractService) {}

  isProcessing(): boolean {
    return this._processing;
  }

  async startOcrProcess(file: any): Promise<string> {
    const jobId = nanoid();
    const progressSubject = new Subject<MessageEvent>();
    this._progressStreams.set(jobId, progressSubject);
    
    this._processing = true;

    // Start OCR processing in background
    void this._processOcrAsync(jobId, file, progressSubject);

    return jobId;
  }

  getProgressStream(jobId: string): Observable<MessageEvent> {
    const stream = this._progressStreams.get(jobId);
    if (!stream) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return stream.asObservable();
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
      const result =
        await this.tesseractService.processImage(file.buffer);

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
      this._progressStreams.delete(jobId);
    }
  }

  private _sendSse(
    progressSubject: Subject<MessageEvent>,
    data: unknown,
  ) {
    progressSubject.next({data: JSON.stringify(data)});
  }
}