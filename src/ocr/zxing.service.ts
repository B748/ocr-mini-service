import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { ChildProcessWithoutNullStreams } from 'node:child_process';

@Injectable()
export class ZxingService {
  private readonly _logger = new Logger(ZxingService.name);

  private isAvailable = false;

  constructor() {
    // CHECK IF JAVA IS AVAILABLE
    try {
      const testProcess = spawn('java', ['-version']);
      testProcess.on('error', () => {
        this._logger.warn(
          'Java not found. Barcode/QR detection disabled.',
        );
        this.isAvailable = false;
      });
      testProcess.on('close', (code) => {
        if (code === 0) {
          this.isAvailable = true;
          this._logger.log('ZXing service initialized successfully');
        }
      });
    } catch (error) {
      this._logger.warn(
        `Failed to initialize ZXing: ${error.message}. Barcode/QR detection disabled.`,
      );
      this.isAvailable = false;
    }
  }

  /**
   * Scans an image file for barcodes and QR codes
   * @param filePath - Path to the image file to scan
   * @returns Promise resolving to scan results as string
   * @throws {Error} When ZXing is not available or scan fails
   */
  scan(filePath: string): Promise<string> {
    if (!this.isAvailable) {
      return Promise.reject(
        new Error('ZXing is not available (Java not installed)'),
      );
    }

    return new Promise((resolve, reject) => {
      // SPAWN NEW PROCESS FOR EACH SCAN
      const process = spawn('java', [
        '-cp',
        '/opt/zxing/zxing.jar',
        'com.google.zxing.client.j2se.CommandLineRunner',
        filePath,
      ]);

      let output = '';
      let errorOutput = '';

      // COLLECT stdout
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      // COLLECT stderr
      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // HANDLE PROCESS COMPLETION
      process.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          this._logger.warn(`ZXing scan failed: ${errorOutput}`);
          reject(new Error(`ZXing scan failed with code ${code}`));
        }
      });

      // HANDLE PROCESS ERRORS
      process.on('error', (error) => {
        reject(error);
      });
    });
  }
}
