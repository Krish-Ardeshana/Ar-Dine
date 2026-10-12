import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalStorageProvider } from './local-storage.provider.js';

describe('LocalStorageProvider', () => {
  const testStorageDir = path.resolve('./storage-test-tmp');
  let provider: LocalStorageProvider;

  beforeAll(() => {
    if (!fs.existsSync(testStorageDir)) {
      fs.mkdirSync(testStorageDir, { recursive: true });
    }

    const mockConfigService = {
      get: (key: string, defaultVal?: string) => {
        if (key === 'STORAGE_DIR') return testStorageDir;
        return defaultVal;
      },
    } as unknown as ConfigService;

    provider = new LocalStorageProvider(mockConfigService);
  });

  afterAll(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  it('should report availability as true', () => {
    expect(provider.isAvailable()).toBe(true);
    expect(provider.name).toBe('local-disk');
  });

  it('should successfully write file to disk within base storage dir', async () => {
    const file = {
      fieldname: 'file',
      originalname: 'dish.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 12,
      buffer: Buffer.from('test-content'),
    };

    const storageKey = 'restaurants/test-r1/images/item1.jpg';
    const result = await provider.uploadFile(file, storageKey);

    expect(result.url).toBe('/storage/restaurants/test-r1/images/item1.jpg');
    expect(result.storageKey).toBe('restaurants/test-r1/images/item1.jpg');
    expect(result.format).toBe('jpg');
    expect(result.fileSizeBytes).toBe(12);

    const targetFile = path.resolve(testStorageDir, storageKey);
    expect(fs.existsSync(targetFile)).toBe(true);
  });

  it('should reject path traversal attempts during upload', async () => {
    const file = {
      fieldname: 'file',
      originalname: 'exploit.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 10,
      buffer: Buffer.from('malicious!'),
    };

    await expect(
      provider.uploadFile(file, '../../outside/exploit.jpg'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should safely delete existing file', async () => {
    const file = {
      fieldname: 'file',
      originalname: 'temp.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 4,
      buffer: Buffer.from('temp'),
    };

    const storageKey = 'restaurants/test-r1/images/to-delete.jpg';
    await provider.uploadFile(file, storageKey);
    const targetFile = path.resolve(testStorageDir, storageKey);
    expect(fs.existsSync(targetFile)).toBe(true);

    await provider.deleteFile(storageKey);
    expect(fs.existsSync(targetFile)).toBe(false);
  });

  it('should reject path traversal attempts during deletion', async () => {
    await expect(
      provider.deleteFile('../../../etc/passwd'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should gracefully handle deletion of non-existent file without crashing', async () => {
    await expect(
      provider.deleteFile('restaurants/test-r1/images/non-existent.jpg'),
    ).resolves.toBeUndefined();
  });
});
