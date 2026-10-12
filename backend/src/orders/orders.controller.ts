import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { RequireRestaurantRole } from '../auth/decorators/restaurant-roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { OrderStatus } from '../database/schemas/order.schema.js';
import { UserRole } from '../database/schemas/user.schema.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderResponseDto } from './dto/order-response.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { OrderEventsService } from './order-events.service.js';
import { OrdersService } from './orders.service.js';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderEventsService: OrderEventsService,
  ) {}

  /**
   * Public: Place a guest order from the digital table menu.
   * Performs authoritative price validation, dining-session verification,
   * item availability checks, and idempotent persistence.
   */
  @Public()
  @Post('restaurants/public/:slug/tables/:tableToken/orders')
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Param('slug') slug: string,
    @Param('tableToken') tableToken: string,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.createOrder(slug, tableToken, dto);
  }

  /**
   * Public: Retrieve customer order tracking state and receipt details.
   * Protected by high-entropy tracking token query param.
   */
  @Public()
  @Get('restaurants/public/:slug/orders/:orderReference')
  @HttpCode(HttpStatus.OK)
  async getPublicOrderTracking(
    @Param('slug') slug: string,
    @Param('orderReference') orderReference: string,
    @Query('token') trackingToken: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.getPublicOrderTracking(slug, orderReference, trackingToken);
  }

  /**
   * Public: Cancel an order as a guest.
   * Allowed ONLY if the order is still in the PLACED state.
   */
  @Public()
  @Post('restaurants/public/:slug/orders/:orderReference/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelPublicOrder(
    @Param('slug') slug: string,
    @Param('orderReference') orderReference: string,
    @Query('token') trackingToken: string,
    @Body() dto: CancelOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.cancelPublicOrder(slug, orderReference, trackingToken, dto);
  }

  /**
   * Public: Real-time SSE stream for customer order tracking.
   */
  @Public()
  @Sse('restaurants/public/:slug/orders/:orderReference/events')
  streamCustomerOrderEvents(
    @Param('orderReference') orderReference: string,
    @Query('token') trackingToken: string,
  ): Observable<MessageEvent> {
    return this.orderEventsService.streamForOrder(orderReference, trackingToken);
  }

  /**
   * Staff/Admin: List orders for a specific restaurant.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN, UserRole.KITCHEN_STAFF, UserRole.WAITER])
  @Get('restaurants/:restaurantId/orders')
  @HttpCode(HttpStatus.OK)
  async getRestaurantOrders(
    @Param('restaurantId') restaurantId: string,
    @Query('status') status?: OrderStatus,
    @Query('limit') limit?: number,
  ): Promise<OrderResponseDto[]> {
    return this.ordersService.getRestaurantOrders(restaurantId, status, limit ? Number(limit) : 50);
  }

  /**
   * Staff/Kitchen: Get active FIFO kitchen display system (KDS) queue.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN, UserRole.KITCHEN_STAFF, UserRole.WAITER])
  @Get('restaurants/:restaurantId/orders/kitchen')
  @HttpCode(HttpStatus.OK)
  async getKitchenQueue(
    @Param('restaurantId') restaurantId: string,
  ): Promise<OrderResponseDto[]> {
    return this.ordersService.getKitchenQueue(restaurantId);
  }

  /**
   * Staff/Admin: Get a specific order by ID.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN, UserRole.KITCHEN_STAFF, UserRole.WAITER])
  @Get('restaurants/:restaurantId/orders/:orderId')
  @HttpCode(HttpStatus.OK)
  async getOrderById(
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.getOrderById(restaurantId, orderId);
  }

  /**
   * Staff/Kitchen: Centralized Order Lifecycle State Machine Transition.
   * Enforces legal sequential transitions and role permissions.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN, UserRole.KITCHEN_STAFF, UserRole.WAITER])
  @Patch('restaurants/:restaurantId/orders/:orderId/status')
  @HttpCode(HttpStatus.OK)
  async updateOrderStatus(
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: any,
  ): Promise<OrderResponseDto> {
    const membership = user?.memberships?.find(
      (m: any) => m.restaurantId?.toString() === restaurantId,
    );
    const userRoles: UserRole[] = membership?.roles || user?.globalRoles || [];

    return this.ordersService.updateOrderStatus(
      restaurantId,
      orderId,
      dto.status,
      userRoles,
      user?.email || 'STAFF',
    );
  }

  /**
   * Staff/Admin: Cancel order with documented reason.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN, UserRole.KITCHEN_STAFF, UserRole.WAITER])
  @Post('restaurants/:restaurantId/orders/:orderId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelStaffOrder(
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: any,
  ): Promise<OrderResponseDto> {
    return this.ordersService.cancelStaffOrder(
      restaurantId,
      orderId,
      dto,
      user?.email || 'STAFF',
    );
  }

  /**
   * Staff/Kitchen: Real-time SSE stream for KDS updates.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN, UserRole.KITCHEN_STAFF, UserRole.WAITER])
  @Sse('restaurants/:restaurantId/orders/events')
  streamKitchenEvents(
    @Param('restaurantId') restaurantId: string,
  ): Observable<MessageEvent> {
    return this.orderEventsService.streamForRestaurant(restaurantId);
  }
}
