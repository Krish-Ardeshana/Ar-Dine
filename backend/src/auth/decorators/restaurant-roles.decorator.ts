import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../database/schemas/user.schema.js';
import { RESTAURANT_ROLES_KEY } from '../constants.js';

export const RequireRestaurantRole = (...roles: UserRole[]) =>
  SetMetadata(RESTAURANT_ROLES_KEY, roles);
