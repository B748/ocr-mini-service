import { Injectable, Logger } from '@nestjs/common';
import { ChildProcess, spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DimensionData, TextContent } from '../types/ocr.types';
import { nanoid } from '../types/nanoid.function';
import { parseTsvOutput } from '../types/ocr-response';

@Injectable()
export class TesseractService {
  private readonly _logger = new Logger(TesseractService.name);
  private readonly _tempDir =
    process.env.TESSERACT_TEMP_DIR || '/tmp/tesseract-api';

  constructor() {
    void this._ensureTempDir();
  }

  /**
   * Gets comprehensive debug information about the Tesseract service
   * @returns Debug information including temp directory, process info, Tesseract version, and system details
   */
  async getDebugInfo() {
    const { promises: fs } = require('fs');

    try {
      // CHECK TEMP DIRECTORY
      const tempDirExists = await fs
        .access(this._tempDir)
        .then(() => true)
        .catch(() => false);
      let tempDirContents = [];
      let tempDirStats = null;
      let writeTest = null;

      if (tempDirExists) {
        try {
          tempDirContents = await fs.readdir(this._tempDir);
          tempDirStats = await fs.stat(this._tempDir);

          // TEST WRITE PERMISSIONS
          const testFile = join(this._tempDir, 'debug-write-test');
          try {
            await fs.writeFile(testFile, 'test');
            await fs.unlink(testFile);
            writeTest = 'success';
          } catch (writeError: any) {
            writeTest = `failed: ${writeError.message}`;
          }
        } catch (error: any) {
          tempDirContents = [`Error reading directory: ${error.message}`];
        }
      }

      // CHECK TESSERACT VERSION
      const tesseractVersion = await this._getTesseractVersion();

      // CHECK AVAILABLE LANGUAGES
      const availableLanguages = await this._getAvailableLanguages();

      return {
        tempDirectory: {
          path: this._tempDir,
          exists: tempDirExists,
          contents: tempDirContents,
          permissions: tempDirStats ? tempDirStats.mode.toString(8) : null,
          owner: tempDirStats
            ? { uid: tempDirStats.uid, gid: tempDirStats.gid }
            : null,
          writeTest: writeTest,
        },
        process: {
          uid: process.getuid ? process.getuid() : 'not available',
          gid: process.getgid ? process.getgid() : 'not available',
          cwd: process.cwd(),
        },
        tesseract: {
          version: tesseractVersion,
          availableLanguages,
        },
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      };
    } catch (error) {
      return {
        error: `Debug info collection failed: ${error.message}`,
      };
    }
  }

  /**
   * Ensures the temporary directory exists and is writable
   * @private
   */
  private async _ensureTempDir() {
    try {
      // TRY TO CREATE THE DIRECTORY
      await fs.mkdir(this._tempDir, { recursive: true });

      // TEST WRITE PERMISSIONS BY CREATING A TEST FILE
      const testFile = join(this._tempDir, 'test-write-permissions');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);

      this._logger.debug(`Temp directory ready: ${this._tempDir}`);
    } catch (error: any) {
      this._logger.error(
        `Failed to setup temp directory ${this._tempDir}:`,
        error,
      );

      // TRY ALTERNATIVE TEMP DIRECTORIES
      const alternatives = [
        '/tmp/ocr-temp',
        '/var/tmp/tesseract-api',
        process.env.TMPDIR || '/tmp',
      ];

      for (const altDir of alternatives) {
        try {
          await fs.mkdir(altDir, { recursive: true });
          const testFile = join(altDir, 'test-write-permissions');
          await fs.writeFile(testFile, 'test');
          await fs.unlink(testFile);

          this._logger.warn(`Using alternative temp directory: ${altDir}`);
          (this as any)._tempDir = altDir; // UPDATE THE TEMP DIRECTORY
          return;
        } catch (altError) {
          this._logger.debug(
            `Alternative temp directory ${altDir} also failed:`,
            altError,
          );
        }
      }

      throw new Error(
        `No writable temp directory found. Last error: ${error.message}`,
      );
    }
  }

  /**
   * Processes an image buffer using Tesseract OCR
   * @param imageBuffer - The image data to process
   * @returns Promise resolving to array of OCR results with text and bounding boxes
   * @throws {Error} When image buffer is invalid or OCR processing fails
   */
  async processImage(
    imageBuffer: Buffer,
  ): Promise<DimensionData<TextContent>[]> {
    // VALIDATE INPUT
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Invalid image buffer provided');
    }

    // CHECK IF TESSERACT IS AVAILABLE
    await this._checkTesseractAvailability();
    const jobId = nanoid();
    const inputPath = join(this._tempDir, `input_${jobId}.png`);
    const outputBasePath = join(this._tempDir, `output_${jobId}`);
    const tsvOutputPath = `${outputBasePath}.tsv`;

    // TRACK WHICH FILES WERE ACTUALLY CREATED
    const createdFiles: string[] = [];

    try {
      // SAVE IMAGE TO TEMP FILE
      try {
        await fs.writeFile(inputPath, imageBuffer);
        createdFiles.push(inputPath);
        this._logger.debug(
          `Created input file: ${inputPath} (${imageBuffer.length} bytes)`,
        );
      } catch (writeError: any) {
        this._logger.error(
          `Failed to write input file to ${inputPath}:`,
          writeError,
        );

        // CHECK DIRECTORY PERMISSIONS
        try {
          const stats = await fs.stat(this._tempDir);
          this._logger.error(
            `Temp directory permissions: ${stats.mode.toString(8)}`,
          );
        } catch (statError) {
          this._logger.error(`Cannot stat temp directory: ${statError.message}`);
        }

        throw new Error(
          `Cannot write to temp directory: ${writeError.message}`,
        );
      }

      // RUN TESSERACT WITH TSV OUTPUT FOR DETAILED WORD-LEVEL DATA
      await this._runTesseract(inputPath, outputBasePath);

      // CHECK IF TSV OUTPUT WAS CREATED
      try {
        await fs.access(tsvOutputPath);
        createdFiles.push(tsvOutputPath);
        this._logger.debug(`Tesseract created output file: ${tsvOutputPath}`);
      } catch {
        this._logger.warn(
          `Tesseract did not create expected output file: ${tsvOutputPath}`,
        );
      }

      // PARSE TSV OUTPUT TO OUR DATA MODEL
      const result = await this._parseTsvOutput(tsvOutputPath);

      // ADD A SMALL DELAY TO SHOW THE FINAL PROGRESS STEP
      await new Promise((resolve) => setTimeout(resolve, 100));

      return result;
    } catch (error) {
      this._logger.error(`OCR processing failed for job ${jobId}:`, error);
      throw error;
    } finally {
      // CLEAN UP ONLY FILES THAT WERE ACTUALLY CREATED
      if (createdFiles.length > 0) {
        await this._cleanupFiles(createdFiles);
      } else {
        this._logger.debug(`No files to cleanup for job ${jobId}`);
      }
    }
  }

  /**
   * Runs Tesseract OCR process on an input image file
   * @param inputPath - Path to the input image file
   * @param outputBasePath - Base path for output files (without extension)
   * @returns Promise that resolves when Tesseract processing completes
   * @throws {Error} When Tesseract process fails
   * @private
   */
  private async _runTesseract(
    inputPath: string,
    outputBasePath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // USE TSV OUTPUT FORMAT FOR DETAILED WORD-LEVEL INFORMATION
      // -L DEU+ENG FOR GERMAN AND ENGLISH
      const args = [inputPath, outputBasePath, '-l', 'deu+eng', 'tsv'];

      this._logger.debug(`Running Tesseract with args: ${args.join(' ')}`);

      const tesseract: ChildProcess = spawn('tesseract', args);

      let stderr = '';
      let stdout = '';

      tesseract.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      tesseract.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;

        // LOG TESSERACT OUTPUT FOR DEBUGGING
        this._logger.debug(`Tesseract stderr: ${chunk.trim()}`);
      });

      tesseract.on('close', (code) => {
        this._logger.debug(`Tesseract process closed with code: ${code}`);
        if (stdout) this._logger.debug(`Tesseract stdout: ${stdout}`);

        if (code === 0) {
          resolve();
        } else {
          const errorMsg = `Tesseract failed with exit code ${code}. stderr: ${stderr}`;
          this._logger.error(errorMsg);
          reject(new Error(errorMsg));
        }
      });

      tesseract.on('error', (error) => {
        const errorMsg = `Failed to start Tesseract process: ${error.message}`;
        this._logger.error(errorMsg);
        reject(new Error(errorMsg));
      });
    });
  }

  /**
   * Parses Tesseract TSV output file into structured OCR data
   * @param tsvPath - Path to the TSV output file from Tesseract
   * @returns Promise resolving to array of OCR results with text and bounding boxes
   * @throws {Error} When TSV file cannot be read or parsed
   * @private
   */
  private async _parseTsvOutput(
    tsvPath: string,
  ): Promise<DimensionData<TextContent>[]> {
    try {
      // CHECK IF FILE EXISTS AND GET ITS SIZE
      const stats = await fs.stat(tsvPath);
      this._logger.debug(`TSV file size: ${stats.size} bytes`);

      if (stats.size === 0) {
        this._logger.warn('TSV file is empty - no text detected in image');
        return [];
      }

      const tsvContent = await fs.readFile(tsvPath, 'utf-8');
      const lines = tsvContent.trim().split('\n');

      this._logger.debug(`TSV file has ${lines.length} lines`);

      if (lines.length < 2) {
        this._logger.warn(
          'TSV file has insufficient data - likely no text detected',
        );
        return [];
      }

      return parseTsvOutput(lines);
    } catch (error) {
      this._logger.error('Failed to parse TSV output', error);
      throw new Error(`Failed to parse OCR results: ${error.message}`);
    }
  }

  /**
   * Cleans up temporary files created during OCR processing
   * @param filePaths - Array of file paths to delete
   * @private
   */
  private async _cleanupFiles(filePaths: string[]) {
    for (const filePath of filePaths) {
      try {
        // CHECK IF FILE EXISTS BEFORE TRYING TO DELETE
        await fs.access(filePath);
        await fs.unlink(filePath);
        this._logger.debug(`Successfully cleaned up file: ${filePath}`);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          this._logger.debug(
            `File already removed or never existed: ${filePath}`,
          );
        } else {
          this._logger.warn(
            `Failed to cleanup file ${filePath}: ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Gets the Tesseract version information
   * @returns Promise resolving to version string
   * @private
   */
  private async _getTesseractVersion(): Promise<string> {
    return new Promise((resolve) => {
      const tesseract = spawn('tesseract', ['--version']);
      let output = '';

      tesseract.stdout?.on('data', (data) => {
        output += data.toString();
      });

      tesseract.stderr?.on('data', (data) => {
        output += data.toString();
      });

      tesseract.on('close', () => {
        resolve(output.trim() || 'Version info not available');
      });

      tesseract.on('error', (error) => {
        resolve(`Error getting version: ${error.message}`);
      });
    });
  }

  /**
   * Gets the list of available Tesseract languages
   * @returns Promise resolving to array of language codes
   * @private
   */
  private async _getAvailableLanguages(): Promise<string[]> {
    return new Promise((resolve) => {
      const tesseract = spawn('tesseract', ['--list-langs']);
      let output = '';

      tesseract.stdout?.on('data', (data) => {
        output += data.toString();
      });

      tesseract.on('close', () => {
        const lines = output.trim().split('\n');
        // SKIP THE FIRST LINE WHICH IS USUALLY "List of available languages (X):"
        const languages = lines.slice(1).filter((line) => line.trim());
        resolve(languages);
      });

      tesseract.on('error', (error) => {
        resolve([`Error getting languages: ${error.message}`]);
      });
    });
  }

  /**
   * Dummy OCR processing function that simulates OCR processing
   * Pauses for 7 seconds then returns a successful mock result
   */
  async dummyOcrProcessing(): Promise<DimensionData<TextContent>[]> {
    this._logger.warn('<< !! DUMMY OCR PROCESSING !! >>');

    // SIMULATE 7-SECOND PROCESSING TIME
    await new Promise(resolve => setTimeout(resolve, 7000));

    // RETURN MOCK SUCCESSFUL OCR RESULT
    const mockResult: DimensionData<TextContent>[] = [
      {
        left: 100,
        top: 50,
        width: 200,
        height: 30,
        data: {
          id: nanoid(),
          text: 'Sample',
          confidence: 95
        }
      },
      {
        left: 320,
        top: 50,
        width: 150,
        height: 30,
        data: {
          id: nanoid(),
          text: 'OCR',
          confidence: 98
        }
      },
      {
        left: 490,
        top: 50,
        width: 180,
        height: 30,
        data: {
          id: nanoid(),
          text: 'Result',
          confidence: 92
        }
      }
    ];

    this._logger.debug('Dummy OCR processing completed successfully');
    return mockResult;
  }

  /**
   * Checks if Tesseract OCR is available and properly installed
   * @returns Promise that resolves if Tesseract is available
   * @throws {Error} When Tesseract is not available or not properly installed
   * @private
   */
  private async _checkTesseractAvailability(): Promise<void> {
    return new Promise((resolve, reject) => {
      const tesseract = spawn('tesseract', ['--version']);

      tesseract.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              'Tesseract OCR is not available or not properly installed',
            ),
          );
        }
      });

      tesseract.on('error', (error) => {
        reject(new Error(`Tesseract OCR is not available: ${error.message}`));
      });
    });
  }
}
