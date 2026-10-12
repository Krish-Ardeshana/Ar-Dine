import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaService } from './media.service.js';
import { LocalStorageProvider } from './providers/local-storage.provider.js';

describe('MediaService', () => {
  let service: MediaService;
  let mockStorageProvider: any;

  const restaurantId = new Types.ObjectId().toHexString();
  const otherRestaurantId = new Types.ObjectId().toHexString();

  beforeEach(() => {
    mockStorageProvider = {
      uploadFile: vi.fn().mockImplementation((_file, key) =>
        Promise.resolve({
          url: `/storage/${key}`,
          storageKey: key,
          format: 'jpg',
          fileSizeBytes: 1024,
        }),
      ),
      deleteFile: vi.fn().mockResolvedValue(undefined),
    };

    service = new MediaService(mockStorageProvider as unknown as LocalStorageProvider);
  });

  describe('uploadDishImage', () => {
    it('should validate and upload valid JPEG image with FF D8 FF magic bytes', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      const validFile = {
        fieldname: 'file',
        originalname: 'dish.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: jpegBuffer.length,
        buffer: jpegBuffer,
      };

      const result = await service.uploadDishImage(restaurantId, validFile, 'Delicious Biryani');

      expect(result.url).toContain('/storage/restaurants/');
      expect(result.storageKey).toContain(`restaurants/${restaurantId}/images/`);
      expect(result.altText).toBe('Delicious Biryani');
      expect(mockStorageProvider.uploadFile).toHaveBeenCalled();
    });

    it('should validate and upload valid PNG image with 89 50 4E 47 magic bytes', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const validFile = {
        fieldname: 'file',
        originalname: 'logo.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: pngBuffer.length,
        buffer: pngBuffer,
      };

      const result = await service.uploadDishImage(restaurantId, validFile);
      expect(result.storageKey).toContain(`restaurants/${restaurantId}/images/`);
      expect(result.storageKey.endsWith('.png')).toBe(true);
    });

    it('should reject corrupted image or invalid magic bytes', async () => {
      const fakeBuffer = Buffer.from('NOT_AN_IMAGE_FILE_BUFFER');
      const invalidFile = {
        fieldname: 'file',
        originalname: 'fake.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: fakeBuffer.length,
        buffer: fakeBuffer,
      };

      await expect(
        service.uploadDishImage(restaurantId, invalidFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject oversized image exceeding 5MB limit', async () => {
      const oversizedFile = {
        fieldname: 'file',
        originalname: 'huge.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 6 * 1024 * 1024,
        buffer: Buffer.alloc(10),
      };

      await expect(
        service.uploadDishImage(restaurantId, oversizedFile),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadDishModel (GLB 3D)', () => {
    it('should validate and upload valid self-contained GLB model with glTF magic bytes', async () => {
      // glTF magic bytes: 0x67, 0x6c, 0x54, 0x46 ("glTF")
      const glbBuffer = Buffer.from([
        0x67, 0x6c, 0x54, 0x46, // "glTF"
        0x02, 0x00, 0x00, 0x00, // Version 2
        0x20, 0x00, 0x00, 0x00, // Total length
      ]);

      const validGlbFile = {
        fieldname: 'file',
        originalname: 'burger.glb',
        encoding: '7bit',
        mimetype: 'model/gltf-binary',
        size: glbBuffer.length,
        buffer: glbBuffer,
      };

      const result = await service.uploadDishModel(restaurantId, validGlbFile);

      expect(result.glbUrl).toBeDefined();
      expect(result.format).toBe('glb');
      expect(result.fileSizeBytes).toBe(glbBuffer.length);
      expect(mockStorageProvider.uploadFile).toHaveBeenCalled();
    });

    it('should reject non-GLB files or invalid 3D header', async () => {
      const invalidBuffer = Buffer.from('<html><script>alert(1)</script></html>');
      const invalidFile = {
        fieldname: 'file',
        originalname: 'exploit.glb',
        encoding: '7bit',
        mimetype: 'model/gltf-binary',
        size: invalidBuffer.length,
        buffer: invalidBuffer,
      };

      await expect(
        service.uploadDishModel(restaurantId, invalidFile),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteMedia tenant protection', () => {
    it('should reject deletion attempt of storageKey belonging to another restaurant', async () => {
      const foreignStorageKey = `restaurants/${otherRestaurantId}/images/secret.jpg`;

      await expect(
        service.deleteMedia(restaurantId, foreignStorageKey),
      ).rejects.toThrow(ForbiddenException);
      expect(mockStorageProvider.deleteFile).not.toHaveBeenCalled();
    });

    it('should allow deletion of storageKey belonging to authorized restaurant', async () => {
      const ownStorageKey = `restaurants/${restaurantId}/images/dish.jpg`;

      await service.deleteMedia(restaurantId, ownStorageKey);
      expect(mockStorageProvider.deleteFile).toHaveBeenCalledWith(ownStorageKey);
    });
  });

  describe('Provider Selection and Fallback', () => {
    it('should default to LocalStorageProvider when STORAGE_PROVIDER is unset', () => {
      const localProvider = { name: 'local-disk', isAvailable: () => true } as any;
      const mediaService = new MediaService(localProvider);
      expect(mediaService.activeStorageProviderName).toBe('local-disk');
    });

    it('should use CloudinaryStorageProvider when configured and available', () => {
      const localProvider = { name: 'local-disk', isAvailable: () => true } as any;
      const cloudProvider = { name: 'cloudinary', isAvailable: () => true } as any;
      const configService = {
        get: (key: string) => (key === 'STORAGE_PROVIDER' ? 'cloudinary' : undefined),
      } as any;

      const mediaService = new MediaService(localProvider, cloudProvider, configService);
      expect(mediaService.activeStorageProviderName).toBe('cloudinary');
    });

    it('should fall back to LocalStorageProvider when Cloudinary is selected but unavailable', () => {
      const localProvider = { name: 'local-disk', isAvailable: () => true } as any;
      const cloudProvider = { name: 'cloudinary', isAvailable: () => false } as any;
      const configService = {
        get: (key: string) => (key === 'STORAGE_PROVIDER' ? 'cloudinary' : undefined),
      } as any;

      const mediaService = new MediaService(localProvider, cloudProvider, configService);
      expect(mediaService.activeStorageProviderName).toBe('local-disk');
    });
  });
});
