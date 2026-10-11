import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import crypto from 'crypto';
import { Model, Types } from 'mongoose';
import {
  AccountStatus,
  User,
  UserDocument,
  UserRole,
} from '../database/schemas/user.schema.js';
import { DEFAULT_JWT_ACCESS_SECRET, DEFAULT_JWT_REFRESH_SECRET } from './constants.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UserProfileDto } from './dto/user-profile.dto.js';
import { PasswordService } from './password.service.js';
import { JwtPayload } from './strategies/jwt.strategy.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService,
  ) {
    this.accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      DEFAULT_JWT_ACCESS_SECRET;

    this.refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      DEFAULT_JWT_REFRESH_SECRET;

    this.accessExpiresIn = this.configService.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
    );
    this.refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
    this.issuer = this.configService.get<string>('JWT_ISSUER', 'ar-dine-api');
    this.audience = this.configService.get<string>('JWT_AUDIENCE', 'ar-dine-app');
  }

  /**
   * Hashes a refresh token string using SHA-256 for secure server-side storage.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Constructs the standardized UserProfileDto from a User document.
   * Guarantees passwordHash and refreshTokenHash are NEVER included.
   */
  buildUserProfile(user: UserDocument): UserProfileDto {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      accountStatus: user.accountStatus,
      globalRoles: user.globalRoles || [UserRole.CUSTOMER],
      memberships: (user.memberships || []).map((m) => ({
        restaurantId: m.restaurantId.toString(),
        roles: m.roles,
      })),
      createdAt: (user as any).createdAt ? (user as any).createdAt.toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Generates a short-lived access token and a rotating refresh token.
   */
  private async generateTokens(user: UserDocument): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      globalRoles: user.globalRoles || [UserRole.CUSTOMER],
      iss: this.issuer,
      aud: this.audience,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn as any,
      }),
      this.jwtService.signAsync(
        { sub: user._id.toString(), type: 'refresh' },
        {
          secret: this.refreshSecret,
          expiresIn: this.refreshExpiresIn as any,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Registers a new customer account.
   * Strictly grants only CUSTOMER role. Ignores any client-supplied privilege fields.
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const normalizedEmail = registerDto.email.trim().toLowerCase();

    // Check existing email to prevent duplicate registration
    const existing = await this.userModel.findOne({ email: normalizedEmail });
    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const passwordHash = await this.passwordService.hashPassword(registerDto.password);

    const newUser = new this.userModel({
      name: registerDto.name.trim(),
      email: normalizedEmail,
      passwordHash,
      accountStatus: AccountStatus.ACTIVE,
      globalRoles: [UserRole.CUSTOMER],
      memberships: [],
    });

    const tokens = await this.generateTokens(newUser);
    newUser.refreshTokenHash = this.hashToken(tokens.refreshToken);
    await newUser.save();

    this.logger.log(`New customer registered successfully: ${normalizedEmail}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 minutes
      user: this.buildUserProfile(newUser),
    };
  }

  /**
   * Authenticates user credentials.
   * Uses generic error messages to prevent account enumeration.
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const normalizedEmail = loginDto.email.trim().toLowerCase();

    // Select passwordHash and refreshTokenHash which are otherwise excluded
    const user = await this.userModel
      .findOne({ email: normalizedEmail })
      .select('+passwordHash +refreshTokenHash');

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.passwordService.verifyPassword(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new ForbiddenException(
        'Your account is currently disabled or suspended. Please contact support.',
      );
    }

    const tokens = await this.generateTokens(user);
    user.refreshTokenHash = this.hashToken(tokens.refreshToken);
    await user.save();

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 minutes
      user: this.buildUserProfile(user),
    };
  }

  /**
   * Refreshes access tokens using a valid refresh token with rotation.
   */
  async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!payload?.sub || payload?.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const user = await this.userModel
      .findById(payload.sub)
      .select('+refreshTokenHash');

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token session has been revoked. Please log in again.');
    }

    const incomingHash = this.hashToken(refreshToken);
    if (user.refreshTokenHash !== incomingHash) {
      // Possible token theft or reuse: invalidate active session immediately
      user.refreshTokenHash = undefined;
      await user.save();
      this.logger.warn(`Refresh token reuse detected for user ${user._id.toString()}. Session revoked.`);
      throw new UnauthorizedException('Token reuse detected. Please log in again.');
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('Your account is currently disabled or suspended.');
    }

    // Token Rotation: issue brand new token pair
    const tokens = await this.generateTokens(user);
    user.refreshTokenHash = this.hashToken(tokens.refreshToken);
    await user.save();

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      user: this.buildUserProfile(user),
    };
  }

  /**
   * Revokes the active refresh token session on the server.
   */
  async logout(userId: string | Types.ObjectId): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).select('+refreshTokenHash');
    if (user) {
      user.refreshTokenHash = undefined;
      await user.save();
    }

    return {
      message:
        'Successfully logged out. Refresh token session has been revoked on the server.',
    };
  }

  /**
   * Retrieves profile for the authenticated user.
   */
  async getProfile(userId: string | Types.ObjectId): Promise<UserProfileDto> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User profile not found');
    }
    return this.buildUserProfile(user);
  }
}
