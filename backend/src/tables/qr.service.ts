import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import QRCode from 'qrcode';

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);
  private readonly frontendBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const configuredUrl = this.configService.get<string>('FRONTEND_BASE_URL');
    this.frontendBaseUrl = (configuredUrl && configuredUrl.trim().length > 0)
      ? configuredUrl.replace(/\/+$/, '')
      : 'http://localhost:3000';
  }

  /**
   * Generates a cryptographically strong, non-sequential table token.
   * Format: `tbl_<16-byte-hex>` (32 hex characters)
   */
  generateTableToken(): string {
    return `tbl_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Computes the immutable public customer URL for a table.
   * Format: `${frontendBaseUrl}/r/${restaurantSlug}/table/${tableToken}`
   */
  computeTableUrl(restaurantSlug: string, tableToken: string): string {
    return `${this.frontendBaseUrl}/r/${encodeURIComponent(restaurantSlug)}/table/${encodeURIComponent(tableToken)}`;
  }

  /**
   * Generates a high-resolution base64 PNG data URL for scanning and digital preview.
   */
  async generateQrDataUrl(url: string): Promise<string> {
    try {
      return await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 400,
        color: {
          dark: '#0f172a', // Slate 900
          light: '#ffffff',
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to generate QR data URL: ${msg}`);
      throw new Error(`QR generation failure: ${msg}`);
    }
  }

  /**
   * Generates a scalable SVG string for physical printing and high-res reproduction.
   */
  async generateQrSvg(url: string): Promise<string> {
    try {
      return await QRCode.toString(url, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to generate QR SVG: ${msg}`);
      throw new Error(`QR SVG generation failure: ${msg}`);
    }
  }
}
