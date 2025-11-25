import { Injectable, Logger } from '@nestjs/common';
import { scanImageData, ZBarSymbol } from '@undecaf/zbar-wasm';
import Jimp from 'jimp';

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
      // READ AND DECODE IMAGE WITH JIMP
      const image = await Jimp.read(filePath);
      
      // CONVERT TO IMAGEDATA FORMAT EXPECTED BY ZBAR
      const imageData = {
        data: new Uint8ClampedArray(image.bitmap.data),
        width: image.bitmap.width,
        height: image.bitmap.height,
      };

      // SCAN IMAGE WITH ZBAR WASM
      const symbols = await scanImageData(imageData);

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
