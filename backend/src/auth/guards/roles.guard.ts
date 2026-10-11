import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../database/schemas/user.schema.js';
import { IS_PUBLIC_KEY, RESTAURANT_ROLES_KEY, ROLES_KEY } from '../constants.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredGlobalRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredRestaurantRoles = this.reflector.getAllAndOverride<UserRole[]>(
      RESTAURANT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, standard JWT authentication is sufficient
    if (!requiredGlobalRoles && !requiredRestaurantRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User identity could not be established');
    }

    // Platform Super Admin bypasses role checks across all tenants
    if (user.globalRoles?.includes(UserRole.SUPER_ADMIN)) {
      return true;
    }

    // 1. Evaluate Global Roles
    if (requiredGlobalRoles && requiredGlobalRoles.length > 0) {
      const hasGlobalRole = requiredGlobalRoles.some((role) =>
        user.globalRoles?.includes(role),
      );

      if (!hasGlobalRole) {
        throw new ForbiddenException(
          `Action requires one of the following global roles: ${requiredGlobalRoles.join(', ')}`,
        );
      }
    }

    // 2. Evaluate Tenant-Scoped Restaurant Roles
    if (requiredRestaurantRoles && requiredRestaurantRoles.length > 0) {
      const targetRestaurantId =
        request.headers['x-restaurant-id'] ||
        request.params?.restaurantId ||
        request.query?.restaurantId ||
        request.body?.restaurantId;

      if (!targetRestaurantId) {
        throw new ForbiddenException(
          'A valid restaurant identifier (x-restaurant-id header or route param) is required to evaluate tenant permissions',
        );
      }

      const targetIdStr = targetRestaurantId.toString();

      const membership = user.memberships?.find(
        (m: any) => m.restaurantId?.toString() === targetIdStr,
      );

      if (!membership) {
        throw new ForbiddenException(
          'Access denied: You hold no authorized staff membership for this restaurant',
        );
      }

      const hasRestaurantRole = requiredRestaurantRoles.some((role) =>
        membership.roles?.includes(role),
      );

      if (!hasRestaurantRole) {
        throw new ForbiddenException(
          `Action requires one of the following restaurant roles: ${requiredRestaurantRoles.join(', ')}`,
        );
      }
    }

    return true;
  }
}
