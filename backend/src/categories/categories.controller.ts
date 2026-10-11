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
import { CategoriesService } from './categories.service.js';
import { CategoryResponseDto } from './dto/category-response.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Controller('restaurants/:restaurantId/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * Create category.
   * Access: RESTAURANT_ADMIN for this restaurant or SUPER_ADMIN.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Param('restaurantId') restaurantId: string,
    @Body() createDto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.createCategory(restaurantId, createDto);
  }

  /**
   * List categories for a restaurant.
   * Public access returns only active categories.
   */
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async getCategories(
    @Param('restaurantId') restaurantId: string,
    @Query('includeInactive') includeInactive?: string,
    @CurrentUser() user?: User,
  ): Promise<CategoryResponseDto[]> {
    const isStaffOrAdmin =
      user &&
      ((user.globalRoles?.includes(UserRole.SUPER_ADMIN)) ||
        user.memberships?.some(
          (m) =>
            m.restaurantId.toString() === restaurantId &&
            m.roles.includes(UserRole.RESTAURANT_ADMIN),
        ));

    const allowInactive = Boolean(includeInactive === 'true' && isStaffOrAdmin);
    return this.categoriesService.getCategories(restaurantId, allowInactive);
  }

  /**
   * Reorder categories.
   * Access: RESTAURANT_ADMIN or SUPER_ADMIN.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN])
  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  async reorderCategories(
    @Param('restaurantId') restaurantId: string,
    @Body() reorderDto: ReorderCategoriesDto,
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesService.reorderCategories(restaurantId, reorderDto);
  }

  /**
   * Get single category details.
   */
  @Public()
  @Get(':categoryId')
  @HttpCode(HttpStatus.OK)
  async getCategory(
    @Param('restaurantId') restaurantId: string,
    @Param('categoryId') categoryId: string,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.getCategoryById(restaurantId, categoryId);
  }

  /**
   * Update category.
   * Access: RESTAURANT_ADMIN or SUPER_ADMIN.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN])
  @Patch(':categoryId')
  @HttpCode(HttpStatus.OK)
  async updateCategory(
    @Param('restaurantId') restaurantId: string,
    @Param('categoryId') categoryId: string,
    @Body() updateDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.updateCategory(
      restaurantId,
      categoryId,
      updateDto,
    );
  }

  /**
   * Delete category safely (fails if dishes exist).
   * Access: RESTAURANT_ADMIN or SUPER_ADMIN.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN])
  @Delete(':categoryId')
  @HttpCode(HttpStatus.OK)
  async deleteCategory(
    @Param('restaurantId') restaurantId: string,
    @Param('categoryId') categoryId: string,
  ): Promise<{ message: string; deletedId: string }> {
    return this.categoriesService.deleteCategory(restaurantId, categoryId);
  }
}
