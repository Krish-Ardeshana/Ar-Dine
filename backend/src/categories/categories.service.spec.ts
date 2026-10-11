import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryStatus } from '../database/schemas/category.schema.js';
import { CategoriesService } from './categories.service.js';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let mockCategoryModel: any;
  let mockMenuItemModel: any;

  const restaurantId = new Types.ObjectId();
  const otherRestaurantId = new Types.ObjectId();
  const categoryId = new Types.ObjectId();

  beforeEach(() => {
    function MockCategory(this: any, data: any) {
      Object.assign(this, data);
      this._id = categoryId;
      this.save = vi.fn().mockResolvedValue(this);
    }
    MockCategory.findOne = vi.fn();
    MockCategory.findById = vi.fn();
    MockCategory.find = vi.fn();
    MockCategory.findByIdAndDelete = vi.fn();
    MockCategory.updateOne = vi.fn();
    mockCategoryModel = MockCategory;

    mockMenuItemModel = {
      countDocuments: vi.fn(),
    };

    service = new CategoriesService(mockCategoryModel, mockMenuItemModel);
  });

  describe('createCategory', () => {
    it('should create category scoped to the authorized restaurant', async () => {
      mockCategoryModel.findOne.mockResolvedValue(null);

      const result = await service.createCategory(restaurantId, {
        name: 'Desserts',
        description: 'Sweet treats',
        displayOrder: 1,
      });

      expect(result.name).toBe('Desserts');
      expect(result.restaurantId).toBe(restaurantId.toString());
      expect(result.status).toBe(CategoryStatus.ACTIVE);
    });

    it('should reject duplicate category name in the same restaurant', async () => {
      mockCategoryModel.findOne.mockResolvedValue({ _id: new Types.ObjectId() });

      await expect(
        service.createCategory(restaurantId, { name: 'Desserts' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getCategoryById & tenant boundary', () => {
    it('should retrieve category if it matches the restaurant tenant', async () => {
      mockCategoryModel.findById.mockResolvedValue({
        _id: categoryId,
        restaurantId,
        name: 'Beverages',
        displayOrder: 0,
        status: CategoryStatus.ACTIVE,
      });

      const result = await service.getCategoryById(restaurantId, categoryId);
      expect(result.name).toBe('Beverages');
    });

    it('should reject access if category belongs to another restaurant tenant', async () => {
      mockCategoryModel.findById.mockResolvedValue({
        _id: categoryId,
        restaurantId: otherRestaurantId,
        name: 'Secret Menu',
      });

      await expect(
        service.getCategoryById(restaurantId, categoryId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteCategory protection', () => {
    it('should reject deletion if category contains active dishes', async () => {
      mockCategoryModel.findById.mockResolvedValue({
        _id: categoryId,
        restaurantId,
        name: 'Main Course',
      });
      mockMenuItemModel.countDocuments.mockResolvedValue(3);

      await expect(
        service.deleteCategory(restaurantId, categoryId),
      ).rejects.toThrow(BadRequestException);
      expect(mockCategoryModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should delete category cleanly if it contains zero dishes', async () => {
      mockCategoryModel.findById.mockResolvedValue({
        _id: categoryId,
        restaurantId,
        name: 'Empty Category',
      });
      mockMenuItemModel.countDocuments.mockResolvedValue(0);
      mockCategoryModel.findByIdAndDelete.mockResolvedValue({});

      const result = await service.deleteCategory(restaurantId, categoryId);
      expect(result.deletedId).toBe(categoryId.toString());
      expect(mockCategoryModel.findByIdAndDelete).toHaveBeenCalledWith(categoryId);
    });
  });
});
