import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Restaurant, RestaurantDocument } from '../database/schemas/restaurant.schema.js';
import {
  RestaurantMembership,
  User,
  UserDocument,
  UserRole,
} from '../database/schemas/user.schema.js';
import { TenantHelper } from '../database/multi-tenant/tenant.helper.js';

@Injectable()
export class MembershipService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<RestaurantDocument>,
  ) {}

  /**
   * Retrieves the authorized memberships for an authenticated user.
   */
  async getUserMemberships(userId: string | Types.ObjectId): Promise<RestaurantMembership[]> {
    const userObjectId = TenantHelper.toObjectId(userId);
    const user = await this.userModel.findById(userObjectId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.memberships || [];
  }

  /**
   * Verifies if a user holds one of the specified roles within a specific restaurant.
   */
  async verifyUserRestaurantRole(
    userId: string | Types.ObjectId,
    restaurantId: string | Types.ObjectId,
    allowedRoles: UserRole[],
  ): Promise<boolean> {
    const userObjectId = TenantHelper.toObjectId(userId);
    const restaurantObjectId = TenantHelper.toObjectId(restaurantId);

    const user = await this.userModel.findById(userObjectId);
    if (!user) {
      return false;
    }

    if (user.globalRoles?.includes(UserRole.SUPER_ADMIN)) {
      return true;
    }

    const membership = user.memberships?.find((m) =>
      m.restaurantId.equals(restaurantObjectId),
    );

    if (!membership) {
      return false;
    }

    return allowedRoles.some((role) => membership.roles.includes(role));
  }

  /**
   * Administrative boundary: Grants a restaurant membership to an existing user.
   * Can only be triggered by SUPER_ADMIN or an existing RESTAURANT_ADMIN for that restaurant.
   */
  async assignMembership(
    actingUserId: string | Types.ObjectId,
    targetUserId: string | Types.ObjectId,
    restaurantId: string | Types.ObjectId,
    rolesToAssign: UserRole[],
  ): Promise<RestaurantMembership[]> {
    const targetObjectId = TenantHelper.toObjectId(targetUserId);
    const restaurantObjectId = TenantHelper.toObjectId(restaurantId);

    // Verify acting user permissions
    const isAuthorized = await this.verifyUserRestaurantRole(
      actingUserId,
      restaurantId,
      [UserRole.SUPER_ADMIN, UserRole.RESTAURANT_ADMIN],
    );

    if (!isAuthorized) {
      throw new ForbiddenException(
        'Only a verified Restaurant Admin or Super Admin may provision staff memberships',
      );
    }

    // Verify restaurant exists
    const restaurant = await this.restaurantModel.findById(restaurantObjectId);
    if (!restaurant) {
      throw new NotFoundException('Target restaurant does not exist');
    }

    // Verify target user exists
    const targetUser = await this.userModel.findById(targetObjectId);
    if (!targetUser) {
      throw new NotFoundException('Target user does not exist');
    }

    // Sanitize roles: cannot assign SUPER_ADMIN via restaurant membership
    const sanitizedRoles = rolesToAssign.filter((r) => r !== UserRole.SUPER_ADMIN);
    if (sanitizedRoles.length === 0) {
      throw new BadRequestException('At least one valid restaurant role must be specified');
    }

    const existingIndex = targetUser.memberships.findIndex((m) =>
      m.restaurantId.equals(restaurantObjectId),
    );

    if (existingIndex >= 0) {
      // Merge unique roles
      const mergedRoles = Array.from(
        new Set([...targetUser.memberships[existingIndex].roles, ...sanitizedRoles]),
      );
      targetUser.memberships[existingIndex].roles = mergedRoles;
    } else {
      targetUser.memberships.push({
        restaurantId: restaurantObjectId,
        roles: sanitizedRoles,
      });
    }

    await targetUser.save();
    return targetUser.memberships;
  }
}
