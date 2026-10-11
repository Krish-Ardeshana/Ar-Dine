import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import crypto from 'crypto';
import path from 'path';
import { TenantHelper } from '../database/multi-tenant/tenant.helper.js';
import { ImageMetadata, Model3DMetadata } from '../database/schemas/menu-item.schema.js';
import { LocalStorageProvider } from './providers/local-storage.provider.js';
import { IStorageProvider, UploadedFileDto } from './storage.interface.js';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_MODEL_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly storageProvider: IStorageProvider;

  constructor(localStorageProvider: LocalStorageProvider) {
    // Uses LocalStorageProvider for reliable zero-dependency execution
    this.storageProvider = localStorageProvider;
  }

  /**
   * Validates and securely stores a dish image.
   */
  async uploadDishImage(
    restaurantId: string,
    file: UploadedFileDto,
    altText?: string,
  ): Promise<ImageMetadata> {
    const rId = TenantHelper.toObjectId(restaurantId).toString();

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('No image file uploaded');
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException(
        `Image size exceeds maximum limit of ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB`,
      );
    }

    if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported image format. Allowed formats: JPEG, PNG, WebP`,
      );
    }

    // Inspect magic numbers
    this.verifyImageMagicBytes(file.buffer, file.mimetype);

    const ext = this.resolveImageExtension(file.mimetype, file.originalname);
    const uniqueKey = `restaurants/${rId}/images/${crypto.randomUUID()}.${ext}`;

    const uploadResult = await this.storageProvider.uploadFile(file, uniqueKey);

    return {
      url: uploadResult.url,
      altText: altText?.trim() || file.originalname,
      storageKey: uploadResult.storageKey,
    };
  }

  /**
   * Validates and securely stores a self-contained 3D GLB model.
   */
  async uploadDishModel(
    restaurantId: string,
    file: UploadedFileDto,
  ): Promise<Model3DMetadata> {
    const rId = TenantHelper.toObjectId(restaurantId).toString();

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('No 3D model file uploaded');
    }

    if (file.size > MAX_MODEL_SIZE_BYTES) {
      throw new BadRequestException(
        `Model file size exceeds maximum limit of ${MAX_MODEL_SIZE_BYTES / (1024 * 1024)}MB`,
      );
    }

    const rawExt = path.extname(file.originalname).toLowerCase();
    if (rawExt !== '.glb') {
      throw new BadRequestException(
        'For MVP stability, only self-contained GLB binary models (.glb) are currently supported',
      );
    }

    // Inspect GLB magic bytes: ASCII "glTF" = 0x46546C67
    this.verifyGlbMagicBytes(file.buffer);

    const uniqueKey = `restaurants/${rId}/models/${crypto.randomUUID()}.glb`;
    const uploadResult = await this.storageProvider.uploadFile(file, uniqueKey);

    return {
      glbUrl: uploadResult.url,
      format: 'glb',
      fileSizeBytes: file.size,
    };
  }

  /**
   * Safely deletes media, preventing cross-tenant asset deletion.
   */
  async deleteMedia(restaurantId: string, storageKey: string): Promise<void> {
    const rId = TenantHelper.toObjectId(restaurantId).toString();
    const expectedPrefix = `restaurants/${rId}/`;

    if (!storageKey.startsWith(expectedPrefix)) {
      throw new ForbiddenException(
        'Access denied: You cannot delete media assets belonging to another restaurant',
      );
    }

    await this.storageProvider.deleteFile(storageKey);
  }

  private verifyImageMagicBytes(buffer: Buffer, mimetype: string): void {
    if (buffer.length < 8) {
      throw new BadRequestException('Invalid image: File is corrupt or too small');
    }

    if (mimetype === 'image/jpeg') {
      // JPEG starts with FF D8 FF
      if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
        throw new BadRequestException('Invalid image: File signature does not match JPEG');
      }
    } else if (mimetype === 'image/png') {
      // PNG starts with 89 50 4E 47 0D 0A 1A 0A
      const isPng =
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47;
      if (!isPng) {
        throw new BadRequestException('Invalid image: File signature does not match PNG');
      }
    } else if (mimetype === 'image/webp') {
      // WebP starts with RIFF (bytes 0-3) and WEBP (bytes 8-11)
      const isRiff = buffer.subarray(0, 4).toString('ascii') === 'RIFF';
      const isWebp = buffer.subarray(8, 12).toString('ascii') === 'WEBP';
      if (!isRiff || !isWebp) {
        throw new BadRequestException('Invalid image: File signature does not match WebP');
      }
    }
  }

  private verifyGlbMagicBytes(buffer: Buffer): void {
    if (buffer.length < 12) {
      throw new BadRequestException('Invalid 3D model: File header too small');
    }

    // Check ASCII 'glTF' magic bytes: 0x67, 0x6c, 0x54, 0x46
    const magic = buffer.subarray(0, 4).toString('ascii');
    if (magic !== 'glTF') {
      throw new BadRequestException(
        'Invalid 3D model: Header signature does not match GLB binary format',
      );
    }
  }

  private resolveImageExtension(mimetype: string, originalname: string): string {
    if (mimetype === 'image/png') return 'png';
    if (mimetype === 'image/webp') return 'webp';
    if (mimetype === 'image/jpeg') return 'jpg';
    const ext = path.extname(originalname).replace('.', '').toLowerCase();
    return ext || 'jpg';
  }
}
