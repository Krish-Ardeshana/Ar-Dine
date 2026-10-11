import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TenantHelper } from '../database/multi-tenant/tenant.helper.js';
import {
  Category,
  CategoryDocument,
  CategoryStatus,
} from '../database/schemas/category.schema.js';
import {
  MenuItem,
  MenuItemDocument,
} from '../database/schemas/menu-item.schema.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { CategoryResponseDto } from './dto/category-response.dto.js';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(MenuItem.name)
    private readonly menuItemModel: Model<MenuItemDocument>,
  ) {}

  /**
   * Creates a new menu category scoped to an authorized restaurant.
   */
  async createCategory(
    restaurantId: string | Types.ObjectId,
    dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const trimmedName = dto.name.trim();

    // Enforce name uniqueness within the same restaurant tenant
    const existing = await this.categoryModel.findOne({
      restaurantId: rId,
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
    });

    if (existing) {
      throw new ConflictException(
        `Category '${trimmedName}' already exists in this restaurant`,
      );
    }

    const category = new this.categoryModel({
      restaurantId: rId,
      name: trimmedName,
      description: dto.description?.trim(),
      displayOrder: dto.displayOrder ?? 0,
      status: dto.status || CategoryStatus.ACTIVE,
    });

    const saved = await category.save();
    return this.mapToResponseDto(saved);
  }

  /**
   * Retrieves categories for a restaurant.
   */
  async getCategories(
    restaurantId: string | Types.ObjectId,
    includeInactive = false,
  ): Promise<CategoryResponseDto[]> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const filter: Record<string, unknown> = { restaurantId: rId };

    if (!includeInactive) {
      filter.status = CategoryStatus.ACTIVE;
    }

    const categories = await this.categoryModel
      .find(filter)
      .sort({ displayOrder: 1, createdAt: 1 });

    return categories.map((c) => this.mapToResponseDto(c));
  }

  /**
   * Retrieves a single category by ID, ensuring tenant isolation.
   */
  async getCategoryById(
    restaurantId: string | Types.ObjectId,
    categoryId: string | Types.ObjectId,
  ): Promise<CategoryResponseDto> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const cId = TenantHelper.toObjectId(categoryId);

    const category = await this.categoryModel.findById(cId);
    if (!category) {
      throw new NotFoundException(`Category not found`);
    }

    TenantHelper.assertTenantMatch(category.restaurantId, rId, 'Category');
    return this.mapToResponseDto(category);
  }

  /**
   * Updates an existing category.
   */
  async updateCategory(
    restaurantId: string | Types.ObjectId,
    categoryId: string | Types.ObjectId,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const cId = TenantHelper.toObjectId(categoryId);

    const category = await this.categoryModel.findById(cId);
    if (!category) {
      throw new NotFoundException(`Category not found`);
    }

    TenantHelper.assertTenantMatch(category.restaurantId, rId, 'Category');

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const duplicate = await this.categoryModel.findOne({
        restaurantId: rId,
        _id: { $ne: cId },
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      });

      if (duplicate) {
        throw new ConflictException(
          `Category '${trimmedName}' already exists in this restaurant`,
        );
      }
      category.name = trimmedName;
    }

    if (dto.description !== undefined) {
      category.description = dto.description?.trim();
    }

    if (dto.displayOrder !== undefined) {
      category.displayOrder = dto.displayOrder;
    }

    if (dto.status !== undefined) {
      category.status = dto.status;
    }

    const updated = await category.save();
    return this.mapToResponseDto(updated);
  }

  /**
   * Safely deletes a category.
   * Prevents silent cascade deletion if dishes are still associated with it.
   */
  async deleteCategory(
    restaurantId: string | Types.ObjectId,
    categoryId: string | Types.ObjectId,
  ): Promise<{ message: string; deletedId: string }> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const cId = TenantHelper.toObjectId(categoryId);

    const category = await this.categoryModel.findById(cId);
    if (!category) {
      throw new NotFoundException(`Category not found`);
    }

    TenantHelper.assertTenantMatch(category.restaurantId, rId, 'Category');

    // Check if any menu item is associated with this category
    const dishesCount = await this.menuItemModel.countDocuments({
      restaurantId: rId,
      categoryId: cId,
    });

    if (dishesCount > 0) {
      throw new BadRequestException(
        `Cannot delete category '${category.name}' because it contains ${dishesCount} menu item(s). Reassign or remove dishes first.`,
      );
    }

    await this.categoryModel.findByIdAndDelete(cId);

    return {
      message: `Category '${category.name}' successfully deleted`,
      deletedId: cId.toString(),
    };
  }

  /**
   * Reorders multiple categories within a restaurant.
   */
  async reorderCategories(
    restaurantId: string | Types.ObjectId,
    dto: ReorderCategoriesDto,
  ): Promise<CategoryResponseDto[]> {
    const rId = TenantHelper.toObjectId(restaurantId);

    for (const item of dto.orders) {
      const cId = TenantHelper.toObjectId(item.id);
      await this.categoryModel.updateOne(
        { _id: cId, restaurantId: rId },
        { $set: { displayOrder: item.displayOrder } },
      );
    }

    return this.getCategories(rId, true);
  }

  private mapToResponseDto(doc: CategoryDocument): CategoryResponseDto {
    return {
      id: doc._id.toString(),
      restaurantId: doc.restaurantId.toString(),
      name: doc.name,
      description: doc.description,
      displayOrder: doc.displayOrder,
      status: doc.status,
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
    };
  }
}
