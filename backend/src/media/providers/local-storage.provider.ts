import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'fs';
import path from 'path';
import {
  IStorageProvider,
  StorageUploadResult,
  UploadedFileDto,
} from '../storage.interface.js';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  readonly name = 'local-disk';
  private readonly baseStorageDir: string;

  constructor(private readonly configService: ConfigService) {
    const configuredDir = this.configService.get<string>('STORAGE_DIR', './storage');
    this.baseStorageDir = path.resolve(configuredDir);

    if (!fs.existsSync(this.baseStorageDir)) {
      fs.mkdirSync(this.baseStorageDir, { recursive: true });
    }
  }

  isAvailable(): boolean {
    return true;
  }

  async uploadFile(
    file: UploadedFileDto,
    storagePath: string,
  ): Promise<StorageUploadResult> {
    // Prevent path traversal
    const normalizedStorageKey = path.normalize(storagePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const absoluteTarget = path.resolve(this.baseStorageDir, normalizedStorageKey);

    // Verify path stays within base directory
    if (!absoluteTarget.startsWith(this.baseStorageDir)) {
      throw new BadRequestException('Security violation: Path traversal detected');
    }

    const targetDir = path.dirname(absoluteTarget);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    await fs.promises.writeFile(absoluteTarget, file.buffer);

    const ext = path.extname(normalizedStorageKey).replace('.', '').toLowerCase();
    // In production, an external CDN or reverse proxy delivers assets. In local dev, serve via static prefix.
    const url = `/storage/${normalizedStorageKey.replace(/\\/g, '/')}`;

    return {
      url,
      storageKey: normalizedStorageKey.replace(/\\/g, '/'),
      format: ext,
      fileSizeBytes: file.size,
    };
  }

  async deleteFile(storageKey: string): Promise<void> {
    const normalizedStorageKey = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, '');
    const absoluteTarget = path.resolve(this.baseStorageDir, normalizedStorageKey);

    if (!absoluteTarget.startsWith(this.baseStorageDir)) {
      throw new BadRequestException('Security violation: Path traversal detected');
    }

    if (fs.existsSync(absoluteTarget)) {
      await fs.promises.unlink(absoluteTarget).catch((err) => {
        this.logger.warn(`Failed to delete local asset: ${err.message}`);
      });
    }
  }
}
