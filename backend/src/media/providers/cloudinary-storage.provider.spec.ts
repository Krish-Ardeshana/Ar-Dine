import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudinaryStorageProvider } from './cloudinary-storage.provider.js';

describe('CloudinaryStorageProvider', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Unconfigured Environment', () => {
    let unconfiguredProvider: CloudinaryStorageProvider;

    beforeEach(() => {
      const mockConfigService = {
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as ConfigService;

      unconfiguredProvider = new CloudinaryStorageProvider(mockConfigService);
    });

    it('should report isAvailable as false when credentials are unset', () => {
      expect(unconfiguredProvider.isAvailable()).toBe(false);
      expect(unconfiguredProvider.name).toBe('cloudinary');
    });

    it('should throw ServiceUnavailableException when upload is attempted without credentials', async () => {
      const file = {
        fieldname: 'file',
        originalname: 'dish.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 100,
        buffer: Buffer.from('test'),
      };

      await expect(
        unconfiguredProvider.uploadFile(file, 'restaurants/r1/images/dish.jpg'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should return safely on deleteFile when unconfigured', async () => {
      await expect(
        unconfiguredProvider.deleteFile('restaurants/r1/images/dish.jpg'),
      ).resolves.toBeUndefined();
    });
  });

  describe('Configured Environment', () => {
    let configuredProvider: CloudinaryStorageProvider;

    beforeEach(() => {
      const mockConfigService = {
        get: (key: string) => {
          if (key === 'CLOUDINARY_CLOUD_NAME') return 'test-cloud';
          if (key === 'CLOUDINARY_API_KEY') return 'test-key-123';
          if (key === 'CLOUDINARY_API_SECRET') return 'test-secret-456';
          return undefined;
        },
      } as unknown as ConfigService;

      configuredProvider = new CloudinaryStorageProvider(mockConfigService);
    });

    it('should report isAvailable as true when all credentials exist', () => {
      expect(configuredProvider.isAvailable()).toBe(true);
    });

    it('should upload image file to Cloudinary image endpoint with signed payload', async () => {
      const file = {
        fieldname: 'file',
        originalname: 'curry.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 512,
        buffer: Buffer.from('image-bytes'),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/restaurants/r1/images/curry.jpg',
          public_id: 'restaurants/r1/images/curry',
          format: 'jpg',
          bytes: 512,
        }),
      } as Response);

      const result = await configuredProvider.uploadFile(file, 'restaurants/r1/images/curry.jpg');

      expect(result.url).toBe(
        'https://res.cloudinary.com/test-cloud/image/upload/v1/restaurants/r1/images/curry.jpg',
      );
      expect(result.storageKey).toBe('restaurants/r1/images/curry');
      expect(result.format).toBe('jpg');
      expect(result.fileSizeBytes).toBe(512);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.cloudinary.com/v1_1/test-cloud/image/upload',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should upload GLB 3D model to Cloudinary raw endpoint with preserved extension', async () => {
      const file = {
        fieldname: 'file',
        originalname: 'burger.glb',
        encoding: '7bit',
        mimetype: 'model/gltf-binary',
        size: 2048,
        buffer: Buffer.from('glTF-bytes'),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          secure_url: 'https://res.cloudinary.com/test-cloud/raw/upload/v1/restaurants/r1/models/burger.glb',
          public_id: 'restaurants/r1/models/burger.glb',
          bytes: 2048,
        }),
      } as Response);

      const result = await configuredProvider.uploadFile(file, 'restaurants/r1/models/burger.glb');

      expect(result.url).toContain('/raw/upload/');
      expect(result.storageKey).toBe('restaurants/r1/models/burger.glb');
      expect(result.format).toBe('glb');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.cloudinary.com/v1_1/test-cloud/raw/upload',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should throw BadGatewayException without exposing API secret when upload fails', async () => {
      const file = {
        fieldname: 'file',
        originalname: 'dish.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 100,
        buffer: Buffer.from('test'),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: { message: 'Invalid API Key or Secret' },
        }),
      } as Response);

      await expect(
        configuredProvider.uploadFile(file, 'restaurants/r1/images/dish.jpg'),
      ).rejects.toThrow(BadGatewayException);

      // Verify secret was not leaked
      try {
        await configuredProvider.uploadFile(file, 'restaurants/r1/images/dish.jpg');
      } catch (err: any) {
        expect(err.message).not.toContain('test-secret-456');
      }
    });

    it('should successfully delete media asset using signed destroy endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: 'ok' }),
      } as Response);

      await expect(
        configuredProvider.deleteFile('restaurants/r1/images/dish'),
      ).resolves.toBeUndefined();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.cloudinary.com/v1_1/test-cloud/image/destroy',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should throw BadGatewayException when Cloudinary deletion fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: 'error' }),
      } as Response);

      await expect(
        configuredProvider.deleteFile('restaurants/r1/images/dish'),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
