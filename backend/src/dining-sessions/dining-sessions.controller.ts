import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { RequireRestaurantRole } from '../auth/decorators/restaurant-roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UserRole } from '../database/schemas/user.schema.js';
import { DiningSessionsService } from './dining-sessions.service.js';
import { OrderValidationResultDto } from './dto/order-validation-result.dto.js';
import { SessionResponseDto } from './dto/session-response.dto.js';
import { ValidateOrderDto } from './dto/validate-order.dto.js';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class DiningSessionsController {
  constructor(private readonly diningSessionsService: DiningSessionsService) {}

  /**
   * Public: Start or resume active dining session upon scanning table QR.
   */
  @Public()
  @Post('restaurants/public/:slug/tables/:tableToken/sessions')
  @HttpCode(HttpStatus.CREATED)
  async getOrCreateSession(
    @Param('slug') slug: string,
    @Param('tableToken') tableToken: string,
  ): Promise<SessionResponseDto> {
    return this.diningSessionsService.getOrCreateActiveSession(slug, tableToken);
  }

  /**
   * Public: Validate active dining session token.
   */
  @Public()
  @Get('dining-sessions/:sessionToken/validate')
  @HttpCode(HttpStatus.OK)
  async validateSession(
    @Param('sessionToken') sessionToken: string,
  ): Promise<SessionResponseDto> {
    return this.diningSessionsService.validateSession(sessionToken);
  }

  /**
   * Public: Revalidate customer cart against server prices and availability.
   */
  @Public()
  @Post('restaurants/public/:slug/tables/:tableToken/orders/validate')
  @HttpCode(HttpStatus.OK)
  async validateCartOrder(
    @Param('slug') slug: string,
    @Param('tableToken') tableToken: string,
    @Body() dto: ValidateOrderDto,
  ): Promise<OrderValidationResultDto> {
    return this.diningSessionsService.validateCartOrder(slug, tableToken, dto);
  }

  /**
   * Staff/Admin: List active dining sessions for a restaurant.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN, UserRole.WAITER, UserRole.KITCHEN_STAFF])
  @Get('restaurants/:restaurantId/dining-sessions')
  @HttpCode(HttpStatus.OK)
  async listActiveSessions(
    @Param('restaurantId') restaurantId: string,
  ): Promise<SessionResponseDto[]> {
    return this.diningSessionsService.listActiveSessions(restaurantId);
  }

  /**
   * Staff/Admin: Close dining session and mark table cleared.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN, UserRole.WAITER, UserRole.KITCHEN_STAFF])
  @Post('restaurants/:restaurantId/dining-sessions/:sessionId/close')
  @HttpCode(HttpStatus.OK)
  async closeSession(
    @Param('restaurantId') restaurantId: string,
    @Param('sessionId') sessionId: string,
  ): Promise<{ message: string }> {
    return this.diningSessionsService.closeSession(restaurantId, sessionId);
  }
}
