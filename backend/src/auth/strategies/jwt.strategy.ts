import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccountStatus, User, UserDocument, UserRole } from '../../database/schemas/user.schema.js';
import { DEFAULT_JWT_ACCESS_SECRET } from '../constants.js';

export interface JwtPayload {
  sub: string;
  email: string;
  globalRoles: UserRole[];
  iss?: string;
  aud?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    const secret =
      configService.get<string>('JWT_ACCESS_SECRET') ||
      configService.get<string>('JWT_SECRET') ||
      DEFAULT_JWT_ACCESS_SECRET;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      issuer: configService.get<string>('JWT_ISSUER', 'ar-dine-api'),
      audience: configService.get<string>('JWT_AUDIENCE', 'ar-dine-app'),
    });
  }

  async validate(payload: JwtPayload): Promise<UserDocument> {
    if (!payload.sub) {
      throw new UnauthorizedException('Malformed token payload');
    }

    const user = await this.userModel.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User account no longer exists');
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('User account is suspended or inactive');
    }

    return user;
  }
}
