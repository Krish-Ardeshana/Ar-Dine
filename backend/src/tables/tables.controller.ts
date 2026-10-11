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
import { Public } from '../auth/decorators/public.decorator.js';
import { RequireRestaurantRole } from '../auth/decorators/restaurant-roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UserRole } from '../database/schemas/user.schema.js';
import { CreateTableDto } from './dto/create-table.dto.js';
import { PublicTableResolutionDto } from './dto/public-table-resolution.dto.js';
import { TableQrResponseDto } from './dto/table-qr-response.dto.js';
import { TableResponseDto } from './dto/table-response.dto.js';
import { UpdateTableDto } from './dto/update-table.dto.js';
import { TablesService } from './tables.service.js';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  /**
   * Public endpoint to resolve table QR link.
   * Format: /api/v1/restaurants/public/:slug/tables/:tableToken
   */
  @Public()
  @Get('restaurants/public/:slug/tables/:tableToken')
  @HttpCode(HttpStatus.OK)
  async resolvePublicTable(
    @Param('slug') slug: string,
    @Param('tableToken') tableToken: string,
  ): Promise<PublicTableResolutionDto> {
    return this.tablesService.resolvePublicTable(slug, tableToken);
  }

  /**
   * Create a new table.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN])
  @Post('restaurants/:restaurantId/tables')
  @HttpCode(HttpStatus.CREATED)
  async createTable(
    @Param('restaurantId') restaurantId: string,
    @Body() createDto: CreateTableDto,
  ): Promise<TableResponseDto> {
    return this.tablesService.createTable(restaurantId, createDto);
  }

  /**
   * List all tables for a restaurant.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN, UserRole.WAITER, UserRole.KITCHEN_STAFF])
  @Get('restaurants/:restaurantId/tables')
  @HttpCode(HttpStatus.OK)
  async getTables(
    @Param('restaurantId') restaurantId: string,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<TableResponseDto[]> {
    return this.tablesService.getTables(restaurantId, includeArchived === 'true');
  }

  /**
   * Batch generate QR codes for tables.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN, UserRole.WAITER, UserRole.KITCHEN_STAFF])
  @Get('restaurants/:restaurantId/tables/qr/batch')
  @HttpCode(HttpStatus.OK)
  async getBatchTableQrs(
    @Param('restaurantId') restaurantId: string,
    @Query('limit') limit?: string,
  ): Promise<TableQrResponseDto[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.tablesService.getBatchTableQrs(restaurantId, parsedLimit);
  }

  /**
   * Get single table details.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN, UserRole.WAITER, UserRole.KITCHEN_STAFF])
  @Get('restaurants/:restaurantId/tables/:tableId')
  @HttpCode(HttpStatus.OK)
  async getTableById(
    @Param('restaurantId') restaurantId: string,
    @Param('tableId') tableId: string,
  ): Promise<TableResponseDto> {
    return this.tablesService.getTableById(restaurantId, tableId);
  }

  /**
   * Update table details.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN])
  @Patch('restaurants/:restaurantId/tables/:tableId')
  @HttpCode(HttpStatus.OK)
  async updateTable(
    @Param('restaurantId') restaurantId: string,
    @Param('tableId') tableId: string,
    @Body() updateDto: UpdateTableDto,
  ): Promise<TableResponseDto> {
    return this.tablesService.updateTable(restaurantId, tableId, updateDto);
  }

  /**
   * Archive table safely.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN])
  @Delete('restaurants/:restaurantId/tables/:tableId')
  @HttpCode(HttpStatus.OK)
  async deleteTable(
    @Param('restaurantId') restaurantId: string,
    @Param('tableId') tableId: string,
  ): Promise<{ message: string }> {
    return this.tablesService.deleteTable(restaurantId, tableId);
  }

  /**
   * Generate QR code for a single table.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN, UserRole.WAITER, UserRole.KITCHEN_STAFF])
  @Get('restaurants/:restaurantId/tables/:tableId/qr')
  @HttpCode(HttpStatus.OK)
  async getTableQr(
    @Param('restaurantId') restaurantId: string,
    @Param('tableId') tableId: string,
  ): Promise<TableQrResponseDto> {
    return this.tablesService.getTableQr(restaurantId, tableId);
  }
}
