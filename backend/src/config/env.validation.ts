import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 4000;

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  FRONTEND_BASE_URL: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  MONGODB_URI?: string;

  /**
   * Primary JWT access secret for signing and verifying access tokens.
   */
  @IsString()
  @IsOptional()
  JWT_ACCESS_SECRET?: string;

  /**
   * Primary JWT access token lifetime (short-lived, e.g. '15m').
   */
  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  /**
   * JWT refresh secret for signing and verifying long-lived refresh tokens.
   */
  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET?: string;

  /**
   * JWT refresh token lifetime (e.g. '7d').
   */
  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsString()
  @IsOptional()
  JWT_ISSUER: string = 'ar-dine-api';

  @IsString()
  @IsOptional()
  JWT_AUDIENCE: string = 'ar-dine-app';

  /**
   * Legacy alias for JWT_ACCESS_SECRET
   */
  @IsString()
  @IsOptional()
  JWT_SECRET?: string;

  /**
   * Local media asset storage directory (defaults to './storage')
   */
  @IsString()
  @IsOptional()
  STORAGE_DIR: string = './storage';

  /**
   * Active media storage provider: 'local' (default) or 'cloudinary'
   */
  @IsString()
  @IsOptional()
  STORAGE_PROVIDER: string = 'local';

  /**
   * Optional Cloudinary Cloud Name
   */
  @IsString()
  @IsOptional()
  CLOUDINARY_CLOUD_NAME?: string;

  /**
   * Optional Cloudinary API Key
   */
  @IsString()
  @IsOptional()
  CLOUDINARY_API_KEY?: string;

  /**
   * Optional Cloudinary API Secret
   */
  @IsString()
  @IsOptional()
  CLOUDINARY_API_SECRET?: string;

  /**
   * Payment Gateway provider: 'sandbox' (default), 'razorpay', 'stripe'
   */
  @IsString()
  @IsOptional()
  PAYMENT_GATEWAY?: string;

  /**
   * Webhook signing secret for payment gateway
   */
  @IsString()
  @IsOptional()
  PAYMENT_WEBHOOK_SECRET?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Config validation error: ${errors.toString()}`);
  }

  // Production safety check: enforce strong non-default JWT secret
  if (validatedConfig.NODE_ENV === Environment.Production) {
    const accessSecret =
      validatedConfig.JWT_ACCESS_SECRET || validatedConfig.JWT_SECRET;
    if (!accessSecret || accessSecret.length < 32) {
      throw new Error(
        'Production security violation: JWT_ACCESS_SECRET must be configured with at least 32 cryptographically random characters in production',
      );
    }
    if (!validatedConfig.JWT_REFRESH_SECRET || validatedConfig.JWT_REFRESH_SECRET.length < 32) {
      throw new Error(
        'Production security violation: JWT_REFRESH_SECRET must be configured with at least 32 cryptographically random characters in production',
      );
    }
    if (validatedConfig.CORS_ORIGIN && validatedConfig.CORS_ORIGIN.trim() === '*') {
      throw new Error(
        'Production security violation: CORS_ORIGIN cannot be set to wildcard (*) when credentialed access is enabled',
      );
    }
  }

  return validatedConfig;
}
