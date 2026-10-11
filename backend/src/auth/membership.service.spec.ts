import { ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Restaurant } from '../database/schemas/restaurant.schema.js';
import { User, UserRole } from '../database/schemas/user.schema.js';
import { MembershipService } from './membership.service.js';

describe('MembershipService', () => {
  let service: MembershipService;
  const restaurantId = new Types.ObjectId();
  const managerId = new Types.ObjectId();
  const targetStaffId = new Types.ObjectId();

  const mockRestaurantModel = {
    findById: vi.fn(),
  };

  const mockUserModel = {
    findById: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Restaurant.name),
          useValue: mockRestaurantModel,
        },
      ],
    }).compile();

    service = module.get<MembershipService>(MembershipService);
  });

  describe('verifyUserRestaurantRole', () => {
    it('should return true if user has required role in target restaurant', async () => {
      mockUserModel.findById.mockResolvedValue({
        _id: managerId,
        globalRoles: [UserRole.CUSTOMER],
        memberships: [
          {
            restaurantId,
            roles: [UserRole.RESTAURANT_ADMIN],
          },
        ],
      });

      const hasRole = await service.verifyUserRestaurantRole(
        managerId,
        restaurantId,
        [UserRole.RESTAURANT_ADMIN],
      );
      expect(hasRole).toBe(true);
    });

    it('should return true if user is global Super Admin regardless of membership', async () => {
      mockUserModel.findById.mockResolvedValue({
        _id: managerId,
        globalRoles: [UserRole.SUPER_ADMIN],
        memberships: [],
      });

      const hasRole = await service.verifyUserRestaurantRole(
        managerId,
        restaurantId,
        [UserRole.RESTAURANT_ADMIN],
      );
      expect(hasRole).toBe(true);
    });

    it('should return false if user has no membership in target restaurant', async () => {
      mockUserModel.findById.mockResolvedValue({
        _id: managerId,
        globalRoles: [UserRole.CUSTOMER],
        memberships: [],
      });

      const hasRole = await service.verifyUserRestaurantRole(
        managerId,
        restaurantId,
        [UserRole.RESTAURANT_ADMIN],
      );
      expect(hasRole).toBe(false);
    });
  });

  describe('assignMembership', () => {
    it('should allow Restaurant Admin to assign Kitchen Staff role', async () => {
      // 1. Acting manager check
      mockUserModel.findById.mockResolvedValueOnce({
        _id: managerId,
        globalRoles: [UserRole.CUSTOMER],
        memberships: [
          {
            restaurantId,
            roles: [UserRole.RESTAURANT_ADMIN],
          },
        ],
      });

      // 2. Restaurant check
      mockRestaurantModel.findById.mockResolvedValue({ _id: restaurantId });

      // 3. Target user check
      const targetUser = {
        _id: targetStaffId,
        memberships: [] as any[],
        save: vi.fn().mockResolvedValue(true),
      };
      mockUserModel.findById.mockResolvedValueOnce(targetUser);

      const memberships = await service.assignMembership(
        managerId,
        targetStaffId,
        restaurantId,
        [UserRole.KITCHEN_STAFF],
      );

      expect(memberships).toHaveLength(1);
      expect(memberships[0].roles).toContain(UserRole.KITCHEN_STAFF);
      expect(targetUser.save).toHaveBeenCalled();
    });

    it('should reject assignment when acting user is not admin for the restaurant', async () => {
      mockUserModel.findById.mockResolvedValueOnce({
        _id: managerId,
        globalRoles: [UserRole.CUSTOMER],
        memberships: [], // Not an admin!
      });

      await expect(
        service.assignMembership(
          managerId,
          targetStaffId,
          restaurantId,
          [UserRole.KITCHEN_STAFF],
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
