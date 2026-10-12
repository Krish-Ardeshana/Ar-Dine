import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import path from 'node:path';
import {
  IStorageProvider,
  StorageUploadResult,
  UploadedFileDto,
} from '../storage.interface.js';

@Injectable()
export class CloudinaryStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(CloudinaryStorageProvider.name);
  readonly name = 'cloudinary';
  private readonly isConfigured: boolean;
  private readonly cloudName?: string;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;

  constructor(private readonly configService: ConfigService) {
    this.cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
    this.apiKey = this.configService.get<string>('CLOUDINARY_API_KEY')?.trim();
    this.apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET')?.trim();

    this.isConfigured = Boolean(this.cloudName && this.apiKey && this.apiSecret);
    if (!this.isConfigured) {
      this.logger.log(
        'Cloudinary credentials not detected in environment. Cloud upload provider marked as UNCONFIGURED.',
      );
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  async uploadFile(
    file: UploadedFileDto,
    storagePath: string,
  ): Promise<StorageUploadResult> {
    if (!this.isConfigured || !this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new ServiceUnavailableException(
        'Cloudinary storage is unconfigured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to enable external cloud uploads.',
      );
    }

    const isGlb =
      file.originalname.toLowerCase().endsWith('.glb') ||
      file.mimetype === 'model/gltf-binary';
    const resourceType = isGlb ? 'raw' : 'image';

    // Normalize public identifier (forward slashes)
    const normalizedKey = storagePath.replace(/\\/g, '/').replace(/^\/+/, '');
    // For images, Cloudinary prefers public_id without the file extension
    const publicId = isGlb
      ? normalizedKey
      : normalizedKey.replace(/\.[^/.]+$/, '');

    const timestamp = Math.floor(Date.now() / 1000);
    // Cloudinary signature formula: alphabetical query params + apiSecret
    const signString = `public_id=${publicId}&timestamp=${timestamp}${this.apiSecret}`;
    const signature = crypto.createHash('sha1').update(signString).digest('hex');

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
    formData.append('file', blob, file.originalname);
    formData.append('api_key', this.apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('public_id', publicId);
    formData.append('signature', signature);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(this.cloudName)}/${resourceType}/upload`;

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorJson = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        const message = errorJson?.error?.message || response.statusText;
        this.logger.error(`Cloudinary upload failed with HTTP ${response.status}: ${message}`);
        throw new BadGatewayException(`Cloudinary rejected upload: ${message}`);
      }

      const data = (await response.json()) as {
        secure_url?: string;
        url?: string;
        public_id: string;
        format?: string;
        bytes?: number;
      };

      const ext = path.extname(storagePath).replace('.', '').toLowerCase();

      return {
        url: data.secure_url || data.url || '',
        storageKey: data.public_id,
        format: data.format || ext || (isGlb ? 'glb' : 'bin'),
        fileSizeBytes: data.bytes ?? file.size,
      };
    } catch (err: unknown) {
      if (err instanceof BadGatewayException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Unknown network failure';
      this.logger.error(`Network communication error contacting Cloudinary: ${message}`);
      throw new BadGatewayException(`Failed to reach cloud media storage service: ${message}`);
    }
  }

  async deleteFile(storageKey: string): Promise<void> {
    if (!this.isConfigured || !this.cloudName || !this.apiKey || !this.apiSecret) {
      this.logger.warn('Skipping Cloudinary deletion: provider is unconfigured');
      return;
    }

    const isRaw = storageKey.includes('/models/') || storageKey.endsWith('.glb');
    const resourceType = isRaw ? 'raw' : 'image';
    const timestamp = Math.floor(Date.now() / 1000);

    const signString = `public_id=${storageKey}&timestamp=${timestamp}${this.apiSecret}`;
    const signature = crypto.createHash('sha1').update(signString).digest('hex');

    const formData = new FormData();
    formData.append('api_key', this.apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('public_id', storageKey);
    formData.append('signature', signature);

    const destroyUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(this.cloudName)}/${resourceType}/destroy`;

    try {
      const response = await fetch(destroyUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorJson = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        const message = errorJson?.error?.message || response.statusText;
        this.logger.error(`Cloudinary destroy failed: ${message}`);
        throw new BadGatewayException(`Cloudinary deletion failed: ${message}`);
      }

      const data = (await response.json()) as { result?: string };
      if (data.result === 'error') {
        throw new BadGatewayException('Cloudinary failed to destroy media asset');
      }

      this.logger.log(`Asset successfully removed from Cloudinary: ${storageKey}`);
    } catch (err: unknown) {
      if (err instanceof BadGatewayException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Unknown network failure';
      this.logger.error(`Error deleting asset from Cloudinary: ${message}`);
      throw new BadGatewayException(`Failed to delete asset from cloud storage: ${message}`);
    }
  }
}
