import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InvitationStatus,
} from '../database/schemas/restaurant-invitation.schema.js';
import {
  OperationalStatus,
  PublicationStatus,
} from '../database/schemas/restaurant.schema.js';
import { UserRole } from '../database/schemas/user.schema.js';
import { RestaurantsService } from './restaurants.service.js';

describe('RestaurantsService', () => {
  let service: RestaurantsService;
  let mockRestaurantModel: any;
  let mockUserModel: any;
  let mockInvitationModel: any;
  let mockMembershipService: any;

  const superAdminId = new Types.ObjectId();
  const restaurantId = new Types.ObjectId();
  const ownerUserId = new Types.ObjectId();

  beforeEach(() => {
    function MockRestaurant(this: any, data: any) {
      Object.assign(this, data);
      this._id = restaurantId;
      this.save = vi.fn().mockResolvedValue(this);
    }
    MockRestaurant.findOne = vi.fn();
    MockRestaurant.findById = vi.fn();
    MockRestaurant.find = vi.fn();
    mockRestaurantModel = MockRestaurant;

    mockUserModel = {
      findOne: vi.fn(),
      findById: vi.fn(),
    };

    function MockInvitation(this: any, data: any) {
      Object.assign(this, data);
      this._id = new Types.ObjectId();
      this.save = vi.fn().mockResolvedValue(this);
    }
    MockInvitation.findOne = vi.fn();
    mockInvitationModel = MockInvitation;

    mockMembershipService = {
      assignMembership: vi.fn().mockResolvedValue([]),
    };

    service = new RestaurantsService(
      mockRestaurantModel,
      mockUserModel,
      mockInvitationModel,
      mockMembershipService,
    );
  });

  describe('createRestaurant', () => {
    const validDto = {
      name: 'Spice Garden',
      slug: 'spice-garden',
      contact: { email: 'contact@spice.com', phone: '+919876543210' },
      address: { street: '123 Main St', city: 'Mumbai', state: 'MH', postalCode: '400001' },
      ownerEmail: 'owner@spice.com',
    };

    it('should create restaurant and assign existing owner as RESTAURANT_ADMIN', async () => {
      mockRestaurantModel.findOne.mockResolvedValue(null);
      mockUserModel.findOne.mockResolvedValue({
        _id: ownerUserId,
        email: 'owner@spice.com',
      });

      const result = await service.createRestaurant(validDto as any, superAdminId);

      expect(result.name).toBe('Spice Garden');
      expect(result.slug).toBe('spice-garden');
      expect(mockMembershipService.assignMembership).toHaveBeenCalledWith(
        superAdminId,
        ownerUserId,
        restaurantId,
        [UserRole.RESTAURANT_ADMIN],
      );
    });

    it('should reject creation if slug already exists', async () => {
      mockRestaurantModel.findOne.mockResolvedValue({ _id: new Types.ObjectId() });

      await expect(
        service.createRestaurant(validDto as any, superAdminId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getRestaurantById', () => {
    it('should return safe public details if restaurant is PUBLISHED', async () => {
      mockRestaurantModel.findById.mockResolvedValue({
        _id: restaurantId,
        name: 'Spice Garden',
        slug: 'spice-garden',
        publicationStatus: PublicationStatus.PUBLISHED,
        operationalStatus: OperationalStatus.OPEN,
        contact: { email: 'info@spice.com', phone: '12345' },
        address: { street: 'Main', city: 'Goa', state: 'GA', postalCode: '403001', country: 'India' },
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      });

      const result = await service.getRestaurantById(restaurantId.toHexString());
      expect(result.name).toBe('Spice Garden');
      expect((result as any).ownerId).toBeUndefined();
    });

    it('should reject public access with NotFoundException if restaurant is DRAFT', async () => {
      mockRestaurantModel.findById.mockResolvedValue({
        _id: restaurantId,
        publicationStatus: PublicationStatus.DRAFT,
      });

      await expect(
        service.getRestaurantById(restaurantId.toHexString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('invitations', () => {
    it('should generate a 64-character token and save hashed token', async () => {
      mockRestaurantModel.findById.mockResolvedValue({ _id: restaurantId });

      const result = await service.createInvitation(
        restaurantId.toHexString(),
        { email: 'chef@spice.com', role: UserRole.KITCHEN_STAFF },
        superAdminId,
      );

      expect(result.email).toBe('chef@spice.com');
      expect(result.role).toBe(UserRole.KITCHEN_STAFF);
      expect(result.invitationToken).toHaveLength(64);
    });

    it('should reject acceptance if token is invalid or expired', async () => {
      const selectMock = vi.fn().mockResolvedValue(null);
      mockInvitationModel.findOne.mockReturnValue({ select: selectMock });

      await expect(
        service.acceptInvitation(
          { token: 'a'.repeat(64) },
          { email: 'user@test.com', memberships: [] } as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject acceptance if user email does not match invitation recipient', async () => {
      const selectMock = vi.fn().mockResolvedValue({
        restaurantId,
        email: 'chef@spice.com',
        role: UserRole.KITCHEN_STAFF,
        status: InvitationStatus.PENDING,
      });
      mockInvitationModel.findOne.mockReturnValue({ select: selectMock });

      await expect(
        service.acceptInvitation(
          { token: 'a'.repeat(64) },
          { email: 'impostor@spice.com', memberships: [] } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
