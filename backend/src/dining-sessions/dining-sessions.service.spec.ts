import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionStatus } from '../database/schemas/dining-session.schema.js';
import {
  AvailabilityStatus,
  MenuItemPublicationStatus,
} from '../database/schemas/menu-item.schema.js';
import { PublicationStatus } from '../database/schemas/restaurant.schema.js';
import { TableStatus } from '../database/schemas/restaurant-table.schema.js';
import { DiningSessionsService } from './dining-sessions.service.js';

describe('DiningSessionsService', () => {
  let service: DiningSessionsService;
  let mockSessionModel: any;
  let mockTableModel: any;
  let mockRestaurantModel: any;
  let mockMenuItemModel: any;

  const validRestaurantId = new Types.ObjectId();
  const validTableId = new Types.ObjectId();
  const validMenuItemId = new Types.ObjectId();

  beforeEach(() => {
    function MockSessionInstance(this: any, data: any) {
      Object.assign(this, data);
      this._id = data._id || new Types.ObjectId();
      this.save = vi.fn().mockResolvedValue(this);
    }

    mockSessionModel = MockSessionInstance as any;
    mockSessionModel.findOne = vi.fn();
    mockSessionModel.findById = vi.fn();
    mockSessionModel.find = vi.fn();

    mockTableModel = {
      findOne: vi.fn(),
      findById: vi.fn(),
    };

    mockRestaurantModel = {
      findOne: vi.fn(),
      findById: vi.fn(),
    };

    mockMenuItemModel = {
      findById: vi.fn(),
    };

    service = new DiningSessionsService(
      mockSessionModel,
      mockTableModel,
      mockRestaurantModel,
      mockMenuItemModel,
    );
  });

  describe('getOrCreateActiveSession', () => {
    it('should create new active dining session and mark table occupied', async () => {
      mockRestaurantModel.findOne.mockResolvedValue({
        _id: validRestaurantId,
        name: 'The Golden Spoon',
        slug: 'golden-spoon',
        publicationStatus: PublicationStatus.PUBLISHED,
      });

      const mockTable = {
        _id: validTableId,
        restaurantId: validRestaurantId,
        tableNumber: 'Table 1',
        operationalStatus: TableStatus.AVAILABLE,
        isArchived: false,
        save: vi.fn().mockResolvedValue(true),
      };
      mockTableModel.findOne.mockResolvedValue(mockTable);

      // No active session currently
      mockSessionModel.findOne.mockResolvedValue(null);

      const session = await service.getOrCreateActiveSession('golden-spoon', 'tbl_token_1');

      expect(session.status).toBe(SessionStatus.ACTIVE);
      expect(session.sessionToken).toMatch(/^ses_[a-f0-9]{48}$/);
      expect(session.tableNumber).toBe('Table 1');
      expect(mockTable.operationalStatus).toBe(TableStatus.OCCUPIED);
      expect(mockTable.save).toHaveBeenCalled();
    });

    it('should allow multiple diners at same table to share existing active session', async () => {
      mockRestaurantModel.findOne.mockResolvedValue({
        _id: validRestaurantId,
        name: 'The Golden Spoon',
        slug: 'golden-spoon',
        publicationStatus: PublicationStatus.PUBLISHED,
      });

      const mockTable = {
        _id: validTableId,
        restaurantId: validRestaurantId,
        tableNumber: 'Table 1',
        operationalStatus: TableStatus.OCCUPIED,
        isArchived: false,
      };
      mockTableModel.findOne.mockResolvedValue(mockTable);

      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      const existingSessionDoc = {
        _id: new Types.ObjectId(),
        restaurantId: validRestaurantId,
        tableId: validTableId,
        sessionToken: 'ses_shared_session_123',
        status: SessionStatus.ACTIVE,
        expiresAt: futureDate,
      };
      mockSessionModel.findOne.mockResolvedValue(existingSessionDoc);

      const session = await service.getOrCreateActiveSession('golden-spoon', 'tbl_token_1');

      expect(session.sessionToken).toBe('ses_shared_session_123');
      expect(session.status).toBe(SessionStatus.ACTIVE);
    });

    it('should reject session creation if table is out of service', async () => {
      mockRestaurantModel.findOne.mockResolvedValue({
        _id: validRestaurantId,
        slug: 'golden-spoon',
        publicationStatus: PublicationStatus.PUBLISHED,
      });

      mockTableModel.findOne.mockResolvedValue({
        _id: validTableId,
        restaurantId: validRestaurantId,
        operationalStatus: TableStatus.OUT_OF_SERVICE,
      });

      await expect(
        service.getOrCreateActiveSession('golden-spoon', 'tbl_token_1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateSession', () => {
    it('should detect expired session in application logic and reject with UnauthorizedException', async () => {
      const pastDate = new Date(Date.now() - 5000); // Expired 5 seconds ago
      const expiredSessionDoc = {
        _id: new Types.ObjectId(),
        restaurantId: validRestaurantId,
        tableId: validTableId,
        sessionToken: 'ses_expired_token',
        status: SessionStatus.ACTIVE,
        expiresAt: pastDate,
        save: vi.fn().mockResolvedValue(true),
      };

      mockSessionModel.findOne.mockResolvedValue(expiredSessionDoc);

      await expect(
        service.validateSession('ses_expired_token'),
      ).rejects.toThrow(UnauthorizedException);

      expect(expiredSessionDoc.status).toBe(SessionStatus.EXPIRED);
      expect(expiredSessionDoc.save).toHaveBeenCalled();
    });
  });

  describe('validateCartOrder (Authoritative price and availability revalidation)', () => {
    it('should revalidate cart with authoritative prices, calculating subtotal and 5% tax', async () => {
      const validSession = {
        id: 'mock_session_id',
        sessionToken: 'ses_valid_token',
        restaurantId: validRestaurantId.toHexString(),
        tableId: validTableId.toHexString(),
        tableNumber: 'Table 1',
        restaurantName: 'The Golden Spoon',
        restaurantSlug: 'golden-spoon',
        status: SessionStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      };

      vi.spyOn(service, 'validateSession').mockResolvedValue(validSession);

      mockRestaurantModel.findOne.mockResolvedValue({
        _id: validRestaurantId,
        slug: 'golden-spoon',
      });

      mockTableModel.findOne.mockResolvedValue({
        _id: validTableId,
        restaurantId: validRestaurantId,
      });

      mockMenuItemModel.findById.mockResolvedValue({
        _id: validMenuItemId,
        name: 'Butter Chicken',
        restaurantId: validRestaurantId,
        price: 450, // Authoritative price from DB
        publicationStatus: MenuItemPublicationStatus.PUBLISHED,
        availabilityStatus: AvailabilityStatus.AVAILABLE,
      });

      const result = await service.validateCartOrder('golden-spoon', 'tbl_token_1', {
        sessionToken: 'ses_valid_token',
        items: [
          {
            menuItemId: validMenuItemId.toHexString(),
            quantity: 2,
            specialInstructions: 'Extra spicy',
          },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.canSubmitInPhase6).toBe(true);
      expect(result.subtotal).toBe(900); // 450 * 2
      expect(result.taxRate).toBe(0.05);
      expect(result.taxAmount).toBe(45); // 5% of 900
      expect(result.grandTotal).toBe(945); // 900 + 45
      expect(result.items[0].unitPrice).toBe(450);
    });

    it('should reject cart validation if dish is unavailable/sold out', async () => {
      const validSession = {
        id: 'mock_session_id',
        sessionToken: 'ses_valid_token',
        restaurantId: validRestaurantId.toHexString(),
        tableId: validTableId.toHexString(),
        tableNumber: 'Table 1',
        restaurantName: 'The Golden Spoon',
        restaurantSlug: 'golden-spoon',
        status: SessionStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      };

      vi.spyOn(service, 'validateSession').mockResolvedValue(validSession);

      mockRestaurantModel.findOne.mockResolvedValue({
        _id: validRestaurantId,
        slug: 'golden-spoon',
      });

      mockTableModel.findOne.mockResolvedValue({
        _id: validTableId,
        restaurantId: validRestaurantId,
      });

      mockMenuItemModel.findById.mockResolvedValue({
        _id: validMenuItemId,
        name: 'Tandoori Roti',
        restaurantId: validRestaurantId,
        price: 30,
        publicationStatus: MenuItemPublicationStatus.PUBLISHED,
        availabilityStatus: AvailabilityStatus.OUT_OF_STOCK, // SOLD OUT!
      });

      await expect(
        service.validateCartOrder('golden-spoon', 'tbl_token_1', {
          sessionToken: 'ses_valid_token',
          items: [{ menuItemId: validMenuItemId.toHexString(), quantity: 3 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject cart validation if dish belongs to a different restaurant (cross-tenant injection)', async () => {
      const otherRestaurantId = new Types.ObjectId();

      const validSession = {
        id: 'mock_session_id',
        sessionToken: 'ses_valid_token',
        restaurantId: validRestaurantId.toHexString(),
        tableId: validTableId.toHexString(),
        tableNumber: 'Table 1',
        restaurantName: 'The Golden Spoon',
        restaurantSlug: 'golden-spoon',
        status: SessionStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      };

      vi.spyOn(service, 'validateSession').mockResolvedValue(validSession);

      mockRestaurantModel.findOne.mockResolvedValue({
        _id: validRestaurantId,
        slug: 'golden-spoon',
      });

      mockTableModel.findOne.mockResolvedValue({
        _id: validTableId,
        restaurantId: validRestaurantId,
      });

      mockMenuItemModel.findById.mockResolvedValue({
        _id: validMenuItemId,
        name: 'Dish From Competitor',
        restaurantId: otherRestaurantId, // Different restaurant!
        price: 100,
        publicationStatus: MenuItemPublicationStatus.PUBLISHED,
        availabilityStatus: AvailabilityStatus.AVAILABLE,
      });

      await expect(
        service.validateCartOrder('golden-spoon', 'tbl_token_1', {
          sessionToken: 'ses_valid_token',
          items: [{ menuItemId: validMenuItemId.toHexString(), quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('closeSession', () => {
    it('should mark session completed and reset table status to AVAILABLE', async () => {
      const sessionId = new Types.ObjectId();
      const mockSession = {
        _id: sessionId,
        restaurantId: validRestaurantId,
        tableId: validTableId,
        status: SessionStatus.ACTIVE,
        closedAt: undefined as any,
        save: vi.fn().mockResolvedValue(true),
      };

      mockSessionModel.findById.mockResolvedValue(mockSession);

      const mockTable = {
        _id: validTableId,
        operationalStatus: TableStatus.OCCUPIED,
        save: vi.fn().mockResolvedValue(true),
      };
      mockTableModel.findById.mockResolvedValue(mockTable);

      const result = await service.closeSession(
        validRestaurantId.toHexString(),
        sessionId.toHexString(),
      );

      expect(mockSession.status).toBe(SessionStatus.COMPLETED);
      expect(mockSession.closedAt).toBeInstanceOf(Date);
      expect(mockTable.operationalStatus).toBe(TableStatus.AVAILABLE);
      expect(result.message).toContain('cleared successfully');
    });
  });
});
