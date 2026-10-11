import { UserRole } from '../../database/schemas/user.schema.js';

export class MembershipDto {
  restaurantId: string;
  roles: UserRole[];
}

export class UserProfileDto {
  id: string;
  name: string;
  email: string;
  accountStatus: string;
  globalRoles: UserRole[];
  memberships: MembershipDto[];
  createdAt: string;
}
