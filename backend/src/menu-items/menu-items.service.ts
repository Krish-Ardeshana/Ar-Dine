import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TenantHelper } from '../database/multi-tenant/tenant.helper.js';
import { TenantValidationService } from '../database/multi-tenant/tenant-validation.service.js';
import {
  AvailabilityStatus,
  MenuItem,
  MenuItemDocument,
  MenuItemPublicationStatus,
} from '../database/schemas/menu-item.schema.js';
import { Order, OrderDocument } from '../database/schemas/order.schema.js';
import { CreateMenuItemDto } from './dto/create-menu-item.dto.js';
import { MenuItemQueryDto } from './dto/menu-item-query.dto.js';
import {
  MenuItemResponseDto,
  PaginatedMenuItemsDto,
} from './dto/menu-item-response.dto.js';
import { UpdateAvailabilityDto } from './dto/update-availability.dto.js';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto.js';

@Injectable()
export class MenuItemsService {
  constructor(
    @InjectModel(MenuItem.name)
    private readonly menuItemModel: Model<MenuItemDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly tenantValidationService: TenantValidationService,
  ) {}

  /**
   * Creates a new menu dish.
   * Validates that category belongs to the authorized restaurant.
   */
  async createMenuItem(
    restaurantId: string | Types.ObjectId,
    dto: CreateMenuItemDto,
  ): Promise<MenuItemResponseDto> {
    const rId = TenantHelper.toObjectId(restaurantId);

    // Verify category belongs to this restaurant tenant
    const category = await this.tenantValidationService.validateCategoryBelongsToRestaurant(
      dto.categoryId,
      rId,
    );

    // Resolve slug
    const resolvedSlug = dto.slug
      ? dto.slug.toLowerCase().trim()
      : this.slugify(dto.name);

    // Enforce slug uniqueness within restaurant
    const existing = await this.menuItemModel.findOne({
      restaurantId: rId,
      slug: resolvedSlug,
    });

    if (existing) {
      throw new ConflictException(
        `A dish with slug '${resolvedSlug}' already exists in this restaurant`,
      );
    }

    const menuItem = new this.menuItemModel({
      restaurantId: rId,
      categoryId: category._id,
      slug: resolvedSlug,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      price: dto.price,
      availabilityStatus: dto.availabilityStatus || AvailabilityStatus.AVAILABLE,
      publicationStatus: dto.publicationStatus || MenuItemPublicationStatus.PUBLISHED,
      image: dto.image,
      model3d: dto.model3d,
      dietary: {
        isVegetarian: Boolean(dto.dietary?.isVegetarian),
        isVegan: Boolean(dto.dietary?.isVegan),
        isGlutenFree: Boolean(dto.dietary?.isGlutenFree),
        spiceLevel: dto.dietary?.spiceLevel,
        allergens: dto.dietary?.allergens || [],
      },
      preparationTimeMinutes: dto.preparationTimeMinutes ?? 15,
    });

    const saved = await menuItem.save();
    return this.mapToResponseDto(saved);
  }

  /**
   * Lists and filters dishes. Public users can only see published dishes.
   */
  async getMenuItems(
    restaurantId: string | Types.ObjectId,
    query: MenuItemQueryDto,
    isStaffOrAdmin = false,
  ): Promise<PaginatedMenuItemsDto> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const filter: Record<string, unknown> = { restaurantId: rId };

    // Public users can only view published dishes
    if (!isStaffOrAdmin) {
      filter.publicationStatus = MenuItemPublicationStatus.PUBLISHED;
    } else if (query.publicationStatus) {
      filter.publicationStatus = query.publicationStatus;
    }

    if (query.categoryId) {
      filter.categoryId = TenantHelper.toObjectId(query.categoryId);
    }

    if (query.availabilityStatus) {
      filter.availabilityStatus = query.availabilityStatus;
    }

    if (query.search) {
      filter.name = { $regex: new RegExp(query.search.trim(), 'i') };
    }

    if (query.isVegetarian) {
      filter['dietary.isVegetarian'] = true;
    }

    if (query.isVegan) {
      filter['dietary.isVegan'] = true;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.menuItemModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.menuItemModel.countDocuments(filter),
    ]);

    return {
      items: items.map((i) => this.mapToResponseDto(i)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves single dish details.
   */
  async getMenuItemById(
    restaurantId: string | Types.ObjectId,
    menuItemId: string | Types.ObjectId,
    isStaffOrAdmin = false,
  ): Promise<MenuItemResponseDto> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const mId = TenantHelper.toObjectId(menuItemId);

    const item = await this.menuItemModel.findById(mId);
    if (!item) {
      throw new NotFoundException('Dish not found');
    }

    TenantHelper.assertTenantMatch(item.restaurantId, rId, 'MenuItem');

    if (!isStaffOrAdmin && item.publicationStatus !== MenuItemPublicationStatus.PUBLISHED) {
      throw new NotFoundException('Dish is not available to the public');
    }

    return this.mapToResponseDto(item);
  }

  /**
   * Updates dish details.
   */
  async updateMenuItem(
    restaurantId: string | Types.ObjectId,
    menuItemId: string | Types.ObjectId,
    dto: UpdateMenuItemDto,
  ): Promise<MenuItemResponseDto> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const mId = TenantHelper.toObjectId(menuItemId);

    const item = await this.menuItemModel.findById(mId);
    if (!item) {
      throw new NotFoundException('Dish not found');
    }

    TenantHelper.assertTenantMatch(item.restaurantId, rId, 'MenuItem');

    if (dto.categoryId) {
      await this.tenantValidationService.validateCategoryBelongsToRestaurant(
        dto.categoryId,
        rId,
      );
      item.categoryId = TenantHelper.toObjectId(dto.categoryId);
    }

    if (dto.slug || (dto.name && !dto.slug)) {
      const newSlug = dto.slug ? dto.slug.toLowerCase().trim() : this.slugify(dto.name!);
      if (newSlug !== item.slug) {
        const duplicate = await this.menuItemModel.findOne({
          restaurantId: rId,
          slug: newSlug,
          _id: { $ne: mId },
        });

        if (duplicate) {
          throw new ConflictException(
            `A dish with slug '${newSlug}' already exists in this restaurant`,
          );
        }
        item.slug = newSlug;
      }
    }

    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.description !== undefined) item.description = dto.description?.trim();
    if (dto.price !== undefined) item.price = dto.price;
    if (dto.availabilityStatus !== undefined) item.availabilityStatus = dto.availabilityStatus;
    if (dto.publicationStatus !== undefined) item.publicationStatus = dto.publicationStatus;
    if (dto.image !== undefined) item.image = dto.image as any;
    if (dto.model3d !== undefined) item.model3d = dto.model3d as any;
    if (dto.preparationTimeMinutes !== undefined) {
      item.preparationTimeMinutes = dto.preparationTimeMinutes;
    }

    if (dto.dietary) {
      item.dietary = {
        isVegetarian: dto.dietary.isVegetarian ?? item.dietary?.isVegetarian ?? false,
        isVegan: dto.dietary.isVegan ?? item.dietary?.isVegan ?? false,
        isGlutenFree: dto.dietary.isGlutenFree ?? item.dietary?.isGlutenFree ?? false,
        spiceLevel: dto.dietary.spiceLevel ?? item.dietary?.spiceLevel,
        allergens: dto.dietary.allergens ?? item.dietary?.allergens ?? [],
      };
    }

    const updated = await item.save();
    return this.mapToResponseDto(updated);
  }

  /**
   * Updates only availability (accessible by Kitchen Staff and Restaurant Admin).
   */
  async updateAvailability(
    restaurantId: string | Types.ObjectId,
    menuItemId: string | Types.ObjectId,
    dto: UpdateAvailabilityDto,
  ): Promise<MenuItemResponseDto> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const mId = TenantHelper.toObjectId(menuItemId);

    const item = await this.menuItemModel.findById(mId);
    if (!item) {
      throw new NotFoundException('Dish not found');
    }

    TenantHelper.assertTenantMatch(item.restaurantId, rId, 'MenuItem');

    item.availabilityStatus = dto.availabilityStatus;
    const updated = await item.save();
    return this.mapToResponseDto(updated);
  }

  /**
   * Deletes a dish or safely archives it if historical orders exist.
   */
  async deleteMenuItem(
    restaurantId: string | Types.ObjectId,
    menuItemId: string | Types.ObjectId,
  ): Promise<{ message: string; deletedId: string; status: 'DELETED' | 'ARCHIVED' }> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const mId = TenantHelper.toObjectId(menuItemId);

    const item = await this.menuItemModel.findById(mId);
    if (!item) {
      throw new NotFoundException('Dish not found');
    }

    TenantHelper.assertTenantMatch(item.restaurantId, rId, 'MenuItem');

    // Check if historical orders reference this item
    const historicalOrdersCount = await this.orderModel.countDocuments({
      'items.menuItemId': mId,
    });

    if (historicalOrdersCount > 0) {
      // Archive instead of destructive delete to protect order auditability
      item.publicationStatus = MenuItemPublicationStatus.ARCHIVED;
      item.availabilityStatus = AvailabilityStatus.OUT_OF_STOCK;
      await item.save();

      return {
        message: `Dish '${item.name}' has been safely archived because it is referenced in ${historicalOrdersCount} historical order(s)`,
        deletedId: mId.toString(),
        status: 'ARCHIVED',
      };
    }

    await this.menuItemModel.findByIdAndDelete(mId);

    return {
      message: `Dish '${item.name}' successfully deleted`,
      deletedId: mId.toString(),
      status: 'DELETED',
    };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private mapToResponseDto(doc: MenuItemDocument): MenuItemResponseDto {
    return {
      id: doc._id.toString(),
      restaurantId: doc.restaurantId.toString(),
      categoryId: doc.categoryId.toString(),
      slug: doc.slug,
      name: doc.name,
      description: doc.description,
      price: doc.price,
      availabilityStatus: doc.availabilityStatus,
      publicationStatus: doc.publicationStatus,
      image: doc.image
        ? {
            url: doc.image.url,
            altText: doc.image.altText,
            storageKey: doc.image.storageKey,
          }
        : undefined,
      model3d: doc.model3d
        ? {
            glbUrl: doc.model3d.glbUrl,
            usdzUrl: doc.model3d.usdzUrl,
            format: doc.model3d.format,
            polyCount: doc.model3d.polyCount,
            fileSizeBytes: doc.model3d.fileSizeBytes,
          }
        : undefined,
      dietary: {
        isVegetarian: Boolean(doc.dietary?.isVegetarian),
        isVegan: Boolean(doc.dietary?.isVegan),
        isGlutenFree: Boolean(doc.dietary?.isGlutenFree),
        spiceLevel: doc.dietary?.spiceLevel,
        allergens: doc.dietary?.allergens || [],
      },
      preparationTimeMinutes: doc.preparationTimeMinutes,
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
    };
  }
}
