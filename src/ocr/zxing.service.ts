import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { ChildProcessWithoutNullStreams } from 'node:child_process';

@Injectable()
export class ZxingService {
  private readonly _logger = new Logger(ZxingService.name);

  private zxingProcess: ChildProcessWithoutNullStreams;

  constructor() {
    // OPEN PERSISTENT ZXing-PROCESS
    this.zxingProcess = spawn('java', [
      '-cp',
      '/opt/zxing/zxing.jar',
      'com.google.zxing.client.j2se.CommandLineRunner',
    ]);

    // LOGGING
    this.zxingProcess.stderr.on('data', (data) =>
      this._logger.error(data.toString()),
    );
  }

  scan(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';

      // EVENT FOR stdout
      this.zxingProcess.stdout.once('data', (data) => {
        output += data.toString();
      });

      // CATCH ERROR
      this.zxingProcess.once('error', reject);

      // SEND FILE PATH TO ZXing
      this.zxingProcess.stdin.write(filePath + '\n');

      // DELAY OR END MARK IF ZXing NEEDS CLI
      setTimeout(() => resolve(output.trim()), 50);
    });
  }
}
