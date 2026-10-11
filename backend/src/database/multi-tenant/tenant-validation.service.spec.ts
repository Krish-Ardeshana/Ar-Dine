import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Category } from '../schemas/category.schema.js';
import { MenuItem } from '../schemas/menu-item.schema.js';
import { RestaurantTable } from '../schemas/restaurant-table.schema.js';
import { TenantValidationService } from './tenant-validation.service.js';

describe('TenantValidationService', () => {
  let service: TenantValidationService;
  const restaurantAId = new Types.ObjectId();
  const restaurantBId = new Types.ObjectId();

  const mockCategoryModel = {
    findById: vi.fn(),
  };

  const mockTableModel = {
    findById: vi.fn(),
  };

  const mockMenuItemModel = {
    find: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantValidationService,
        {
          provide: getModelToken(Category.name),
          useValue: mockCategoryModel,
        },
        {
          provide: getModelToken(RestaurantTable.name),
          useValue: mockTableModel,
        },
        {
          provide: getModelToken(MenuItem.name),
          useValue: mockMenuItemModel,
        },
      ],
    }).compile();

    service = module.get<TenantValidationService>(TenantValidationService);
  });

  describe('validateCategoryBelongsToRestaurant', () => {
    it('should return category when it belongs to target restaurant', async () => {
      const categoryId = new Types.ObjectId();
      const mockDoc = { _id: categoryId, restaurantId: restaurantAId, name: 'Starters' };
      mockCategoryModel.findById.mockResolvedValue(mockDoc);

      const result = await service.validateCategoryBelongsToRestaurant(
        categoryId,
        restaurantAId,
      );
      expect(result).toBe(mockDoc);
    });

    it('should throw BadRequestException when category belongs to another restaurant (cross-tenant)', async () => {
      const categoryId = new Types.ObjectId();
      const mockDoc = { _id: categoryId, restaurantId: restaurantBId, name: 'Starters' };
      mockCategoryModel.findById.mockResolvedValue(mockDoc);

      await expect(
        service.validateCategoryBelongsToRestaurant(categoryId, restaurantAId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when category does not exist', async () => {
      mockCategoryModel.findById.mockResolvedValue(null);
      await expect(
        service.validateCategoryBelongsToRestaurant(new Types.ObjectId(), restaurantAId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateTableBelongsToRestaurant', () => {
    it('should return table when it belongs to target restaurant', async () => {
      const tableId = new Types.ObjectId();
      const mockDoc = { _id: tableId, restaurantId: restaurantAId, tableNumber: 'T-01' };
      mockTableModel.findById.mockResolvedValue(mockDoc);

      const result = await service.validateTableBelongsToRestaurant(tableId, restaurantAId);
      expect(result).toBe(mockDoc);
    });

    it('should throw BadRequestException when table belongs to another restaurant', async () => {
      const tableId = new Types.ObjectId();
      const mockDoc = { _id: tableId, restaurantId: restaurantBId, tableNumber: 'T-01' };
      mockTableModel.findById.mockResolvedValue(mockDoc);

      await expect(
        service.validateTableBelongsToRestaurant(tableId, restaurantAId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateMenuItemsBelongToRestaurant', () => {
    it('should pass when all menu items belong to target restaurant', async () => {
      const item1 = { _id: new Types.ObjectId(), restaurantId: restaurantAId, name: 'Biryani' };
      const item2 = { _id: new Types.ObjectId(), restaurantId: restaurantAId, name: 'Raita' };
      mockMenuItemModel.find.mockResolvedValue([item1, item2]);

      const result = await service.validateMenuItemsBelongToRestaurant(
        [item1._id, item2._id],
        restaurantAId,
      );
      expect(result).toHaveLength(2);
    });

    it('should throw BadRequestException when any menu item belongs to another restaurant', async () => {
      const item1 = { _id: new Types.ObjectId(), restaurantId: restaurantAId, name: 'Biryani' };
      const item2 = { _id: new Types.ObjectId(), restaurantId: restaurantBId, name: 'Foreign Dish' };
      mockMenuItemModel.find.mockResolvedValue([item1, item2]);

      await expect(
        service.validateMenuItemsBelongToRestaurant([item1._id, item2._id], restaurantAId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if one or more items cannot be found', async () => {
      mockMenuItemModel.find.mockResolvedValue([]);
      await expect(
        service.validateMenuItemsBelongToRestaurant([new Types.ObjectId()], restaurantAId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
