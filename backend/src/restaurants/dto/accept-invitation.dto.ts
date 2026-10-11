import { IsNotEmpty, IsString, Length } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  @Length(64, 64, { message: 'Invitation token must be a 64-character hexadecimal string' })
  token: string;
}
