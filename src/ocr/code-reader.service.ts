import { Injectable, Logger } from '@nestjs/common';
import { scanImageData, ZBarSymbol } from '@undecaf/zbar-wasm';
import { promises as fs } from 'fs';

@Injectable()
export class CodeReaderService {
  private readonly _logger = new Logger(CodeReaderService.name);

  constructor() {
    this._logger.log('ZBar WASM service initialized successfully');
  }

  /**
   * Scans an image file for barcodes and QR codes using ZBar WASM
   * @param filePath - Path to the image file to scan
   * @returns Promise resolving to array of detected codes
   */
  async scan(filePath: string): Promise<ZBarSymbol[]> {
    try {
      // READ IMAGE FILE AS BUFFER
      const imageBuffer = await fs.readFile(filePath);

      // SCAN IMAGE WITH ZBAR WASM
      const symbols = await scanImageData(imageBuffer);

      this._logger.debug(
        `ZBar scan completed: found ${symbols.length} symbols`,
      );

      return symbols;
    } catch (error) {
      this._logger.warn(`ZBar scan failed: ${error.message}`);
      throw new Error(`ZBar scan failed: ${error.message}`);
    }
  }
}
