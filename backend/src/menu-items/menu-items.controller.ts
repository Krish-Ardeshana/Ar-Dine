import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { RequireRestaurantRole } from '../auth/decorators/restaurant-roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { User, UserRole } from '../database/schemas/user.schema.js';
import { CreateMenuItemDto } from './dto/create-menu-item.dto.js';
import { MenuItemQueryDto } from './dto/menu-item-query.dto.js';
import {
  MenuItemResponseDto,
  PaginatedMenuItemsDto,
} from './dto/menu-item-response.dto.js';
import { UpdateAvailabilityDto } from './dto/update-availability.dto.js';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto.js';
import { MenuItemsService } from './menu-items.service.js';

@Controller('restaurants/:restaurantId/menu-items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MenuItemsController {
  constructor(private readonly menuItemsService: MenuItemsService) {}

  /**
   * Create a new dish.
   * Access: RESTAURANT_ADMIN for this restaurant or SUPER_ADMIN.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createMenuItem(
    @Param('restaurantId') restaurantId: string,
    @Body() createDto: CreateMenuItemDto,
  ): Promise<MenuItemResponseDto> {
    return this.menuItemsService.createMenuItem(restaurantId, createDto);
  }

  /**
   * List and filter dishes.
   * Public access returns only published items.
   */
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async getMenuItems(
    @Param('restaurantId') restaurantId: string,
    @Query() query: MenuItemQueryDto,
    @CurrentUser() user?: User,
  ): Promise<PaginatedMenuItemsDto> {
    const isStaffOrAdmin =
      user &&
      ((user.globalRoles?.includes(UserRole.SUPER_ADMIN)) ||
        user.memberships?.some(
          (m) =>
            m.restaurantId.toString() === restaurantId &&
            (m.roles.includes(UserRole.RESTAURANT_ADMIN) ||
              m.roles.includes(UserRole.KITCHEN_STAFF)),
        ));

    return this.menuItemsService.getMenuItems(
      restaurantId,
      query,
      Boolean(isStaffOrAdmin),
    );
  }

  /**
   * Get single dish details.
   */
  @Public()
  @Get(':menuItemId')
  @HttpCode(HttpStatus.OK)
  async getMenuItem(
    @Param('restaurantId') restaurantId: string,
    @Param('menuItemId') menuItemId: string,
    @CurrentUser() user?: User,
  ): Promise<MenuItemResponseDto> {
    const isStaffOrAdmin =
      user &&
      ((user.globalRoles?.includes(UserRole.SUPER_ADMIN)) ||
        user.memberships?.some(
          (m) =>
            m.restaurantId.toString() === restaurantId &&
            (m.roles.includes(UserRole.RESTAURANT_ADMIN) ||
              m.roles.includes(UserRole.KITCHEN_STAFF)),
        ));

    return this.menuItemsService.getMenuItemById(
      restaurantId,
      menuItemId,
      Boolean(isStaffOrAdmin),
    );
  }

  /**
   * Update dish details.
   * Access: RESTAURANT_ADMIN for this restaurant or SUPER_ADMIN.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN])
  @Patch(':menuItemId')
  @HttpCode(HttpStatus.OK)
  async updateMenuItem(
    @Param('restaurantId') restaurantId: string,
    @Param('menuItemId') menuItemId: string,
    @Body() updateDto: UpdateMenuItemDto,
  ): Promise<MenuItemResponseDto> {
    return this.menuItemsService.updateMenuItem(
      restaurantId,
      menuItemId,
      updateDto,
    );
  }

  /**
   * Quick availability toggle (AVAILABLE / OUT_OF_STOCK).
   * Access: RESTAURANT_ADMIN or KITCHEN_STAFF for this restaurant.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN, UserRole.KITCHEN_STAFF])
  @Patch(':menuItemId/availability')
  @HttpCode(HttpStatus.OK)
  async updateAvailability(
    @Param('restaurantId') restaurantId: string,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: UpdateAvailabilityDto,
  ): Promise<MenuItemResponseDto> {
    return this.menuItemsService.updateAvailability(
      restaurantId,
      menuItemId,
      dto,
    );
  }

  /**
   * Safe dish deletion or archiving.
   * Access: RESTAURANT_ADMIN for this restaurant or SUPER_ADMIN.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN])
  @Delete(':menuItemId')
  @HttpCode(HttpStatus.OK)
  async deleteMenuItem(
    @Param('restaurantId') restaurantId: string,
    @Param('menuItemId') menuItemId: string,
  ): Promise<{ message: string; deletedId: string; status: 'DELETED' | 'ARCHIVED' }> {
    return this.menuItemsService.deleteMenuItem(restaurantId, menuItemId);
  }
}
