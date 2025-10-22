import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class VersionService {
  private readonly _logger = new Logger(VersionService.name);
  private _version: string;
  private _packageInfo: any;

  constructor() {
    this.loadPackageInfo();
  }

  private loadPackageInfo() {
    try {
      const packagePath = join(process.cwd(), 'package.json');
      const packageContent = readFileSync(packagePath, 'utf8');
      this._packageInfo = JSON.parse(packageContent);
      this._version = this._packageInfo.version;
    } catch (error) {
      this._logger.warn('Could not load package.json');
      this._version = '<unknown>';
      this._packageInfo = { name: 'tesseract-api', version: this._version };
    }
  }

  getVersion(): string {
    return this._version;
  }

  getPackageInfo() {
    return {
      name: this._packageInfo.name,
      version: this._version,
      description: this._packageInfo.description,
    };
  }

  getRuntimeInfo() {
    return {
      version: this._version,
      startTime: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    };
  }
}