import { UserProfileDto } from './user-profile.dto.js';

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserProfileDto;
}
