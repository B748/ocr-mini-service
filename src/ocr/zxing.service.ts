import { Injectable, Logger } from '@nestjs/common';
import { ChildProcess, spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DataContent, DimensionData } from '../types/ocr.types';
import { nanoid } from '../types/nanoid.function';

@Injectable()
export class ZxingService {
  private readonly _logger = new Logger(ZxingService.name);
  private readonly _tempDir =
    process.env.TESSERACT_TEMP_DIR || '/tmp/tesseract-api';

  /**
   * Processes an image buffer to detect barcodes and QR codes using ZXing
   * @param imageBuffer - The image data to process
   * @returns Promise resolving to array of detected codes with bounding boxes
   * @throws {Error} When image buffer is invalid or ZXing processing fails
   */
  async processImage(
    imageBuffer: Buffer,
  ): Promise<DimensionData<DataContent>[]> {
    // VALIDATE INPUT
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Invalid image buffer provided');
    }

    // CHECK IF ZXING IS AVAILABLE
    await this._checkZxingAvailability();

    const jobId = nanoid();
    const inputPath = join(this._tempDir, `zxing_input_${jobId}.png`);

    try {
      // SAVE IMAGE TO TEMP FILE
      await fs.writeFile(inputPath, imageBuffer);
      this._logger.debug(
        `Created ZXing input file: ${inputPath} (${imageBuffer.length} bytes)`,
      );

      // RUN ZXING TO DETECT CODES
      return await this._runZxing(inputPath);
    } catch (error) {
      this._logger.error(`ZXing processing failed for job ${jobId}:`, error);
      throw error;
    } finally {
      // CLEANUP INPUT FILE
      try {
        await fs.unlink(inputPath);
        this._logger.debug(`Cleaned up ZXing input file: ${inputPath}`);
      } catch (cleanupError) {
        this._logger.warn(
          `Failed to cleanup ZXing file ${inputPath}: ${cleanupError.message}`,
        );
      }
    }
  }

  /**
   * Runs ZXing process on an input image file
   * @param inputPath - Path to the input image file
   * @returns Promise resolving to array of detected codes
   * @throws {Error} When ZXing process fails
   * @private
   */
  private async _runZxing(
    inputPath: string,
  ): Promise<DimensionData<DataContent>[]> {
    return new Promise((resolve, reject) => {
      // USE `ZXingReader` (FROM `zxing-cpp` PACKAGE) WITH JSON OUTPUT FORMAT
      // --format JSON OUTPUTS STRUCTURED DATA WITH POSITION INFORMATION
      const args = ['--format', 'JSON', inputPath];

      this._logger.debug(`Running ZXingReader with args: ${args.join(' ')}`);

      const zxing: ChildProcess = spawn('ZXingReader', args);

      let stdout = '';
      let stderr = '';

      zxing.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      zxing.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      zxing.on('close', (code) => {
        this._logger.debug(`ZXing process closed with code: ${code}`);

        if (code === 0) {
          try {
            const results = this._parseZxingOutput(stdout);
            resolve(results);
          } catch (parseError) {
            reject(
              new Error(`Failed to parse ZXing output: ${parseError.message}`),
            );
          }
        } else {
          // CODE 1 TYPICALLY MEANS NO CODES FOUND, WHICH IS NOT AN ERROR
          if (code === 1 && !stderr) {
            this._logger.debug('No barcodes or QR codes detected in image');
            resolve([]);
          } else {
            const errorMsg = `ZXing failed with exit code ${code}. stderr: ${stderr}`;
            this._logger.error(errorMsg);
            reject(new Error(errorMsg));
          }
        }
      });

      zxing.on('error', (error) => {
        const errorMsg = `Failed to start ZXing process: ${error.message}`;
        this._logger.error(errorMsg);
        reject(new Error(errorMsg));
      });
    });
  }

  /**
   * Parses ZXing JSON output into structured data
   * @param output - JSON output from ZXing
   * @returns Array of detected codes with bounding boxes
   * @private
   */
  private _parseZxingOutput(output: string): DimensionData<DataContent>[] {
    if (!output || output.trim() === '') {
      this._logger.debug('Empty ZXing output - no codes detected');
      return [];
    }

    try {
      const jsonData = JSON.parse(output);
      const results: DimensionData<DataContent>[] = [];

      // ZXING CAN RETURN SINGLE OBJECT OR ARRAY
      const codes = Array.isArray(jsonData) ? jsonData : [jsonData];

      for (const code of codes) {
        if (!code.text) continue;

        // EXTRACT POSITION DATA IF AVAILABLE
        const position = code.position || {};
        const topLeft = position.topLeft || { x: 0, y: 0 };
        const bottomRight = position.bottomRight || { x: 0, y: 0 };

        const left = topLeft.x;
        const top = topLeft.y;
        const width = bottomRight.x - topLeft.x;
        const height = bottomRight.y - topLeft.y;

        // DETERMINE CODE TYPE
        let codeType: 'QR_CODE' | 'BAR_CODE' | 'OTHER' = 'OTHER';
        if (code.format) {
          if (code.format.includes('QR')) {
            codeType = 'QR_CODE';
          } else if (
            code.format.includes('EAN') ||
            code.format.includes('UPC') ||
            code.format.includes('Code')
          ) {
            codeType = 'BAR_CODE';
          }
        }

        results.push({
          left,
          top,
          width,
          height,
          data: {
            id: nanoid(),
            content: code.text,
            type: codeType,
          },
        });

        this._logger.debug(
          `Detected ${codeType}: ${code.text.substring(0, 50)}...`,
        );
      }

      return results;
    } catch (error) {
      this._logger.error('Failed to parse ZXing JSON output', error);
      throw new Error(`Failed to parse ZXing results: ${error.message}`);
    }
  }

  /**
   * Checks if ZXing is available and properly installed
   * @returns Promise that resolves if ZXing is available
   * @throws {Error} When ZXing is not available or not properly installed
   * @private
   */
  private async _checkZxingAvailability(): Promise<void> {
    return new Promise((resolve, reject) => {
      const zxing = spawn('ZXingReader', ['--version']);

      let versionOutput = '';

      zxing.stdout?.on('data', (data) => {
        versionOutput += data.toString();
      });

      zxing.stderr?.on('data', (data) => {
        versionOutput += data.toString();
      });

      zxing.on('close', (code) => {
        if (code === 0 || versionOutput.includes('ZXing')) {
          this._logger.debug(`ZXing available: ${versionOutput.trim()}`);
          resolve();
        } else {
          reject(
            new Error('ZXing is not available or not properly installed'),
          );
        }
      });

      zxing.on('error', (error) => {
        reject(new Error(`ZXing is not available: ${error.message}`));
      });
    });
  }
}
