import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from '../schemas/category.schema.js';
import { RestaurantTable, RestaurantTableDocument } from '../schemas/restaurant-table.schema.js';
import { MenuItem, MenuItemDocument } from '../schemas/menu-item.schema.js';
import { TenantHelper } from './tenant.helper.js';

@Injectable()
export class TenantValidationService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(RestaurantTable.name)
    private readonly tableModel: Model<RestaurantTableDocument>,
    @InjectModel(MenuItem.name)
    private readonly menuItemModel: Model<MenuItemDocument>,
  ) {}

  /**
   * Validates that a Category exists and strictly belongs to the specified restaurant tenant.
   */
  async validateCategoryBelongsToRestaurant(
    categoryId: string | Types.ObjectId,
    restaurantId: string | Types.ObjectId,
  ): Promise<CategoryDocument> {
    const cId = TenantHelper.toObjectId(categoryId);
    const rId = TenantHelper.toObjectId(restaurantId);

    const category = await this.categoryModel.findById(cId);
    if (!category) {
      throw new NotFoundException(`Category not found: ${cId.toHexString()}`);
    }

    TenantHelper.assertTenantMatch(category.restaurantId, rId, 'Category');
    return category;
  }

  /**
   * Validates that a RestaurantTable exists and strictly belongs to the specified restaurant tenant.
   */
  async validateTableBelongsToRestaurant(
    tableId: string | Types.ObjectId,
    restaurantId: string | Types.ObjectId,
  ): Promise<RestaurantTableDocument> {
    const tId = TenantHelper.toObjectId(tableId);
    const rId = TenantHelper.toObjectId(restaurantId);

    const table = await this.tableModel.findById(tId);
    if (!table) {
      throw new NotFoundException(`Table not found: ${tId.toHexString()}`);
    }

    TenantHelper.assertTenantMatch(table.restaurantId, rId, 'RestaurantTable');
    return table;
  }

  /**
   * Validates that all MenuItem references in an order snapshot belong to the specified restaurant.
   */
  async validateMenuItemsBelongToRestaurant(
    menuItemIds: (string | Types.ObjectId)[],
    restaurantId: string | Types.ObjectId,
  ): Promise<MenuItemDocument[]> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const itemObjectIds = menuItemIds.map((id) => TenantHelper.toObjectId(id));

    const items = await this.menuItemModel.find({
      _id: { $in: itemObjectIds },
    });

    if (items.length !== itemObjectIds.length) {
      throw new NotFoundException('One or more menu items could not be found');
    }

    for (const item of items) {
      TenantHelper.assertTenantMatch(item.restaurantId, rId, `MenuItem (${item.name})`);
    }

    return items;
  }
}
