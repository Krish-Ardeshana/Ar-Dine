import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '../../database/schemas/user.schema.js';

export class CreateInvitationDto {
  @IsEmail({}, { message: 'Must be a valid email address' })
  email: string;

  @IsEnum([UserRole.RESTAURANT_ADMIN, UserRole.KITCHEN_STAFF, UserRole.WAITER], {
    message: 'Role must be RESTAURANT_ADMIN, KITCHEN_STAFF, or WAITER',
  })
  @IsNotEmpty()
  role: UserRole;
}
