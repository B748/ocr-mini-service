import { Injectable, Logger } from '@nestjs/common';
import { scanImageData, ZBarSymbol } from '@undecaf/zbar-wasm';
import Jimp from 'jimp';
import { DimensionData, DataContent } from '../types/ocr.types';
import { nanoid } from '../types/nanoid.function';

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

  /**
   * Scans an image file and returns normalized code detection results
   * @param filePath - Path to the image file to scan
   * @returns Promise resolving to array of normalized code results with coordinates between 0-1
   */
  async processImage(
    filePath: string,
  ): Promise<DimensionData<DataContent>[]> {
    try {
      // READ IMAGE TO GET DIMENSIONS
      const image = await Jimp.read(filePath);
      const imageWidth = image.bitmap.width;
      const imageHeight = image.bitmap.height;

      // SCAN FOR CODES
      const symbols = await this.scan(filePath);

      // CONVERT TO NORMALIZED FORMAT
      const codes = symbols.map((symbol) => {
        const points = symbol.points || [];
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        const left = Math.min(...xs) / imageWidth; // NORMALIZE TO 0-1
        const top = Math.min(...ys) / imageHeight; // NORMALIZE TO 0-1
        const width = (Math.max(...xs) - Math.min(...xs)) / imageWidth; // NORMALIZE TO 0-1
        const height = (Math.max(...ys) - Math.min(...ys)) / imageHeight; // NORMALIZE TO 0-1

        // CONVERT Int8Array TO STRING
        const content =
          typeof symbol.data === 'string'
            ? symbol.data
            : new TextDecoder().decode(symbol.data);

        return {
          left,
          top,
          width,
          height,
          data: {
            id: nanoid(),
            content,
            type: symbol.typeName.toUpperCase(),
          },
        };
      });

      this._logger.debug(
        `Code normalization completed: ${codes.length} codes with normalized coordinates`,
      );

      return codes;
    } catch (error) {
      this._logger.warn(
        `Code scanning and normalization failed: ${error.message}`,
      );
      throw new Error(
        `Code scanning and normalization failed: ${error.message}`,
      );
    }
  }
}
