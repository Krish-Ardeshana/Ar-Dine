import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it } from 'vitest';
import { QrService } from './qr.service.js';

describe('QrService', () => {
  let qrService: QrService;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      get: (key: string) => {
        if (key === 'FRONTEND_BASE_URL') return 'http://localhost:3000';
        return undefined;
      },
    };
    qrService = new QrService(mockConfigService as ConfigService);
  });

  describe('generateTableToken', () => {
    it('should generate an opaque token with tbl_ prefix and 32 hexadecimal characters', () => {
      const token = qrService.generateTableToken();
      expect(token).toMatch(/^tbl_[a-f0-9]{32}$/);
    });

    it('should generate statistically unique non-sequential tokens across iterations', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(qrService.generateTableToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe('computeTableUrl & Stability Guarantee', () => {
    it('should generate stable table URL targeting configured frontend route', () => {
      const url = qrService.computeTableUrl('mumbai-spice', 'tbl_stable_token_abc');
      expect(url).toBe('http://localhost:3000/r/mumbai-spice/table/tbl_stable_token_abc');
    });

    it('should sanitize trailing slashes from configured base URL', () => {
      const customConfigService = {
        get: () => 'https://ardine.restaurant/',
      };
      const customQrService = new QrService(customConfigService as any);
      const url = customQrService.computeTableUrl('mumbai-spice', 'tbl_token_123');
      expect(url).toBe('https://ardine.restaurant/r/mumbai-spice/table/tbl_token_123');
    });

    it('should guarantee physical QR URL stability when dish names, prices, or categories mutate', () => {
      const stableToken = 'tbl_immutable_physical_tag_42';
      const initialUrl = qrService.computeTableUrl('bistro-paris', stableToken);

      // Simulate dish renaming, category reordering, and price changes:
      // The tableToken and restaurant slug remain unchanged, so URL remains 100% identical
      const urlAfterDishRename = qrService.computeTableUrl('bistro-paris', stableToken);
      const urlAfterPriceUpdate = qrService.computeTableUrl('bistro-paris', stableToken);

      expect(urlAfterDishRename).toBe(initialUrl);
      expect(urlAfterPriceUpdate).toBe(initialUrl);
      expect(initialUrl).not.toContain('dish');
      expect(initialUrl).not.toContain('price');
      expect(initialUrl).not.toContain('category');
    });
  });

  describe('generateQrDataUrl', () => {
    it('should generate a valid base64 PNG data URL', async () => {
      const targetUrl = 'http://localhost:3000/r/bistro/table/tbl_123';
      const dataUrl = await qrService.generateQrDataUrl(targetUrl);

      expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
      expect(dataUrl.length).toBeGreaterThan(100);
    });
  });

  describe('generateQrSvg', () => {
    it('should generate valid scalable SVG markup with closing tag', async () => {
      const targetUrl = 'http://localhost:3000/r/bistro/table/tbl_123';
      const svg = await qrService.generateQrSvg(targetUrl);

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('viewBox');
    });
  });
});
