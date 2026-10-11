import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AvailabilityStatus,
  MenuItemPublicationStatus,
} from '../database/schemas/menu-item.schema.js';
import { MenuItemsService } from './menu-items.service.js';

describe('MenuItemsService', () => {
  let service: MenuItemsService;
  let mockMenuItemModel: any;
  let mockOrderModel: any;
  let mockTenantValidationService: any;

  const restaurantId = new Types.ObjectId();
  const otherRestaurantId = new Types.ObjectId();
  const categoryId = new Types.ObjectId();
  const menuItemId = new Types.ObjectId();

  beforeEach(() => {
    function MockMenuItem(this: any, data: any) {
      Object.assign(this, data);
      this._id = menuItemId;
      this.save = vi.fn().mockResolvedValue(this);
    }
    MockMenuItem.findOne = vi.fn();
    MockMenuItem.findById = vi.fn();
    MockMenuItem.find = vi.fn();
    MockMenuItem.countDocuments = vi.fn();
    MockMenuItem.findByIdAndDelete = vi.fn();
    mockMenuItemModel = MockMenuItem;

    mockOrderModel = {
      countDocuments: vi.fn(),
    };

    mockTenantValidationService = {
      validateCategoryBelongsToRestaurant: vi.fn().mockResolvedValue({
        _id: categoryId,
        restaurantId,
        name: 'Curries',
      }),
    };

    service = new MenuItemsService(
      mockMenuItemModel,
      mockOrderModel,
      mockTenantValidationService,
    );
  });

  describe('createMenuItem', () => {
    const validDto = {
      name: 'Butter Chicken',
      categoryId: categoryId.toHexString(),
      price: 349,
      preparationTimeMinutes: 20,
    };

    it('should create menu item with auto-generated slug and validated category', async () => {
      mockMenuItemModel.findOne.mockResolvedValue(null);

      const result = await service.createMenuItem(restaurantId, validDto as any);

      expect(result.name).toBe('Butter Chicken');
      expect(result.slug).toBe('butter-chicken');
      expect(result.price).toBe(349);
      expect(result.availabilityStatus).toBe(AvailabilityStatus.AVAILABLE);
      expect(
        mockTenantValidationService.validateCategoryBelongsToRestaurant,
      ).toHaveBeenCalledWith(categoryId.toHexString(), restaurantId);
    });

    it('should reject duplicate slug in the same restaurant', async () => {
      mockMenuItemModel.findOne.mockResolvedValue({ _id: new Types.ObjectId() });

      await expect(
        service.createMenuItem(restaurantId, validDto as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('tenant isolation & public visibility', () => {
    it('should reject access if menu item belongs to another restaurant tenant', async () => {
      mockMenuItemModel.findById.mockResolvedValue({
        _id: menuItemId,
        restaurantId: otherRestaurantId,
        name: 'Alien Dish',
      });

      await expect(
        service.getMenuItemById(restaurantId, menuItemId, false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject public viewer from seeing DRAFT dish', async () => {
      mockMenuItemModel.findById.mockResolvedValue({
        _id: menuItemId,
        restaurantId,
        name: 'Experimental Dish',
        publicationStatus: MenuItemPublicationStatus.DRAFT,
      });

      await expect(
        service.getMenuItemById(restaurantId, menuItemId, false),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow staff/admin to view DRAFT dish', async () => {
      mockMenuItemModel.findById.mockResolvedValue({
        _id: menuItemId,
        restaurantId,
        categoryId,
        name: 'Experimental Dish',
        slug: 'experimental-dish',
        price: 199,
        availabilityStatus: AvailabilityStatus.AVAILABLE,
        publicationStatus: MenuItemPublicationStatus.DRAFT,
        preparationTimeMinutes: 10,
        dietary: {},
      });

      const result = await service.getMenuItemById(restaurantId, menuItemId, true);
      expect(result.name).toBe('Experimental Dish');
      expect(result.publicationStatus).toBe(MenuItemPublicationStatus.DRAFT);
    });
  });

  describe('deleteMenuItem & historical order protection', () => {
    it('should safely archive dish if historical orders exist', async () => {
      const saveMock = vi.fn().mockResolvedValue({});
      mockMenuItemModel.findById.mockResolvedValue({
        _id: menuItemId,
        restaurantId,
        name: 'Popular Biryani',
        publicationStatus: MenuItemPublicationStatus.PUBLISHED,
        availabilityStatus: AvailabilityStatus.AVAILABLE,
        save: saveMock,
      });
      mockOrderModel.countDocuments.mockResolvedValue(15);

      const result = await service.deleteMenuItem(restaurantId, menuItemId);

      expect(result.status).toBe('ARCHIVED');
      expect(saveMock).toHaveBeenCalled();
      expect(mockMenuItemModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should permanently delete dish if zero historical orders exist', async () => {
      mockMenuItemModel.findById.mockResolvedValue({
        _id: menuItemId,
        restaurantId,
        name: 'Brand New Dish',
      });
      mockOrderModel.countDocuments.mockResolvedValue(0);
      mockMenuItemModel.findByIdAndDelete.mockResolvedValue({});

      const result = await service.deleteMenuItem(restaurantId, menuItemId);

      expect(result.status).toBe('DELETED');
      expect(mockMenuItemModel.findByIdAndDelete).toHaveBeenCalledWith(menuItemId);
    });
  });
});
