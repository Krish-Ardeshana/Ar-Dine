import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    this.isConfigured = Boolean(cloudName && apiKey && apiSecret);
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
    _file: UploadedFileDto,
    _storagePath: string,
  ): Promise<StorageUploadResult> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Cloudinary storage is unconfigured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to enable external cloud uploads.',
      );
    }

    // In a live configured environment with cloudinary SDK, we would upload via cloudinary.uploader.upload_stream
    throw new BadRequestException('Live cloud provider integration not enabled in current environment');
  }

  async deleteFile(storageKey: string): Promise<void> {
    if (!this.isConfigured) {
      return;
    }
    this.logger.log(`Cloud deletion request for key: ${storageKey}`);
  }
}
