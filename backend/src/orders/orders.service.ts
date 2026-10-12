import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import crypto from 'node:crypto';
import { DiningSessionsService } from '../dining-sessions/dining-sessions.service.js';
import { TenantHelper } from '../database/multi-tenant/tenant.helper.js';
import {
  AvailabilityStatus,
  MenuItem,
  MenuItemDocument,
  MenuItemPublicationStatus,
} from '../database/schemas/menu-item.schema.js';
import {
  Order,
  OrderDocument,
  OrderItemSnapshot,
  OrderStatus,
  PaymentStatus,
} from '../database/schemas/order.schema.js';
import {
  PublicationStatus,
  Restaurant,
  RestaurantDocument,
} from '../database/schemas/restaurant.schema.js';
import {
  RestaurantTable,
  RestaurantTableDocument,
  TableStatus,
} from '../database/schemas/restaurant-table.schema.js';
import { UserRole } from '../database/schemas/user.schema.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderItemResponseDto, OrderResponseDto } from './dto/order-response.dto.js';
import { OrderEventsService } from './order-events.service.js';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(RestaurantTable.name)
    private readonly tableModel: Model<RestaurantTableDocument>,
    @InjectModel(MenuItem.name)
    private readonly menuItemModel: Model<MenuItemDocument>,
    private readonly diningSessionsService: DiningSessionsService,
    private readonly orderEventsService: OrderEventsService,
  ) {}

  /**
   * Helper to format order document into response DTO
   */
  private toResponseDto(
    order: any,
    tableNumber?: string,
    includeTrackingToken = true,
  ): OrderResponseDto {
    const tableResolvedNumber =
      tableNumber ||
      (order.tableId as any)?.tableNumber ||
      'Table';

    const items: OrderItemResponseDto[] = (order.items || []).map((item: any) => ({
      menuItemId: item.menuItemId ? item.menuItemId.toString() : '',
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
      specialInstructions: item.specialInstructions,
    }));

    return {
      id: order._id.toString(),
      restaurantId: order.restaurantId.toString(),
      tableId: (order.tableId as any)?._id
        ? (order.tableId as any)._id.toString()
        : order.tableId.toString(),
      tableNumber: tableResolvedNumber,
      diningSessionId: order.diningSessionId?.toString(),
      orderNumber: order.orderNumber,
      trackingToken: includeTrackingToken ? order.trackingToken : undefined,
      items,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount ?? 0,
      grandTotal: order.grandTotal,
      status: order.status,
      paymentStatus: order.paymentStatus,
      placedAt: order.placedAt,
      confirmedAt: order.confirmedAt,
      preparedAt: order.preparedAt,
      servedAt: order.servedAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      cancellationReason: order.cancellationReason,
      cancelledBy: order.cancelledBy,
      createdAt: (order as any).createdAt,
      updatedAt: (order as any).updatedAt,
    };
  }

  /**
   * Generates a unique, receipt-friendly order reference: ORD-YYYYMMDD-XXXX
   */
  private async generateUniqueOrderNumber(_restaurantId: Types.ObjectId): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let orderNumber = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      attempts++;
      const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
      orderNumber = `ORD-${dateStr}-${rand}`;
      const existing = await this.orderModel.findOne({ orderNumber });
      if (!existing) {
        isUnique = true;
      }
    }

    if (!isUnique) {
      orderNumber = `ORD-${dateStr}-${Date.now().toString(36).toUpperCase()}`;
    }

    return orderNumber;
  }

  /**
   * Public guest order placement:
   * Validates dining session, table, menu items, prices, and creates persistent order.
   * Protects against duplicate submissions via database-scoped idempotency.
   */
  async createOrder(
    slug: string,
    tableToken: string,
    dto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    const restaurant = await this.restaurantModel.findOne({
      slug: slug.trim().toLowerCase(),
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    if (restaurant.publicationStatus !== PublicationStatus.PUBLISHED) {
      throw new NotFoundException('Restaurant is currently unpublished');
    }

    // 1. Idempotency Check: if idempotencyKey is supplied, check for existing order
    if (dto.idempotencyKey && dto.idempotencyKey.trim().length > 0) {
      const cleanKey = dto.idempotencyKey.trim();
      const existingOrder = await this.orderModel
        .findOne({
          restaurantId: restaurant._id,
          idempotencyKey: cleanKey,
        })
        .populate<{ tableId: RestaurantTableDocument }>('tableId');

      if (existingOrder) {
        // Verify payload matches to allow safe idempotent retry
        const itemIdsMatch =
          existingOrder.items.length === dto.items.length &&
          dto.items.every((reqItem) =>
            existingOrder.items.some(
              (snap) =>
                snap.menuItemId.toString() === reqItem.menuItemId &&
                snap.quantity === reqItem.quantity,
            ),
          );

        if (!itemIdsMatch) {
          throw new ConflictException(
            'Idempotency key already used with a conflicting order payload',
          );
        }

        return this.toResponseDto(
          existingOrder,
          (existingOrder.tableId as any)?.tableNumber,
          true,
        );
      }
    }

    // 2. Validate active dining session
    const sessionContext = await this.diningSessionsService.validateSession(dto.sessionToken);

    // 3. Validate physical table
    const table = await this.tableModel.findOne({
      tableToken: tableToken.trim(),
    });

    if (!table || !TenantHelper.areObjectIdsEqual(table.restaurantId, restaurant._id)) {
      throw new NotFoundException('Table not found or invalid QR link');
    }

    if (table.isArchived || table.operationalStatus === TableStatus.OUT_OF_SERVICE) {
      throw new BadRequestException('Table is currently out of service');
    }

    if (
      sessionContext.restaurantId !== restaurant._id.toString() ||
      sessionContext.tableId !== table._id.toString()
    ) {
      throw new UnauthorizedException('Dining session does not match this table');
    }

    // 4. Validate menu items and construct authoritative historical snapshots
    let subtotal = 0;
    const itemSnapshots: OrderItemSnapshot[] = [];

    for (const requestedItem of dto.items) {
      if (requestedItem.quantity < 1 || requestedItem.quantity > 50) {
        throw new BadRequestException(
          `Invalid quantity (${requestedItem.quantity}). Must be between 1 and 50.`,
        );
      }

      const itemObjectId = TenantHelper.toObjectId(requestedItem.menuItemId);
      const menuItem = await this.menuItemModel.findById(itemObjectId);

      if (!menuItem) {
        throw new NotFoundException(`Dish not found: ${requestedItem.menuItemId}`);
      }

      if (!TenantHelper.areObjectIdsEqual(menuItem.restaurantId, restaurant._id)) {
        throw new BadRequestException(
          `Dish "${menuItem.name}" does not belong to this restaurant`,
        );
      }

      if (menuItem.publicationStatus !== MenuItemPublicationStatus.PUBLISHED) {
        throw new BadRequestException(
          `Dish "${menuItem.name}" is no longer on the public menu`,
        );
      }

      if (menuItem.availabilityStatus !== AvailabilityStatus.AVAILABLE) {
        throw new BadRequestException(
          `Dish "${menuItem.name}" is currently sold out / unavailable`,
        );
      }

      const itemSubtotal = Number((menuItem.price * requestedItem.quantity).toFixed(2));
      subtotal += itemSubtotal;

      itemSnapshots.push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        unitPrice: menuItem.price,
        quantity: requestedItem.quantity,
        subtotal: itemSubtotal,
        specialInstructions: requestedItem.specialInstructions?.trim() || undefined,
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    const taxRate = 0.05; // Standard 5% tax policy
    const taxAmount = Number((subtotal * taxRate).toFixed(2));
    const grandTotal = Number((subtotal + taxAmount).toFixed(2));

    const orderNumber = await this.generateUniqueOrderNumber(restaurant._id);
    const trackingToken = `trk_${crypto.randomBytes(16).toString('hex')}`;

    const order = new this.orderModel({
      restaurantId: restaurant._id,
      tableId: table._id,
      diningSessionId: TenantHelper.toObjectId(sessionContext.id),
      orderNumber,
      trackingToken,
      idempotencyKey: dto.idempotencyKey?.trim() || undefined,
      items: itemSnapshots,
      subtotal,
      taxAmount,
      discountAmount: 0,
      grandTotal,
      status: OrderStatus.PLACED,
      paymentStatus: PaymentStatus.PENDING,
      placedAt: new Date(),
    });

    const savedOrder = await order.save();

    const responseDto = this.toResponseDto(savedOrder, table.tableNumber, true);

    // Broadcast real-time order event for KDS and tracking subscribers
    this.orderEventsService.emitOrderEvent('ORDER_PLACED', responseDto);

    return responseDto;
  }

  /**
   * Public customer order tracking view:
   * Requires matching trackingToken to prevent enumerating or accessing other diners' orders.
   */
  async getPublicOrderTracking(
    slug: string,
    orderReference: string,
    trackingToken: string,
  ): Promise<OrderResponseDto> {
    if (!trackingToken || trackingToken.trim().length === 0) {
      throw new UnauthorizedException('Order tracking requires a valid tracking token');
    }

    const restaurant = await this.restaurantModel.findOne({
      slug: slug.trim().toLowerCase(),
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const order = await this.orderModel
      .findOne({
        restaurantId: restaurant._id,
        orderNumber: orderReference.trim(),
      })
      .populate<{ tableId: RestaurantTableDocument }>('tableId');

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.trackingToken !== trackingToken.trim()) {
      throw new ForbiddenException('Invalid tracking credentials for this order');
    }

    return this.toResponseDto(order, (order.tableId as any)?.tableNumber, true);
  }

  /**
   * Public guest cancellation:
   * Permitted ONLY while order is in PLACED state.
   */
  async cancelPublicOrder(
    slug: string,
    orderReference: string,
    trackingToken: string,
    dto: CancelOrderDto,
  ): Promise<OrderResponseDto> {
    const restaurant = await this.restaurantModel.findOne({
      slug: slug.trim().toLowerCase(),
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const order = await this.orderModel
      .findOne({
        restaurantId: restaurant._id,
        orderNumber: orderReference.trim(),
      })
      .populate<{ tableId: RestaurantTableDocument }>('tableId');

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.trackingToken !== trackingToken.trim()) {
      throw new ForbiddenException('Invalid tracking credentials for this order');
    }

    if (order.status !== OrderStatus.PLACED) {
      throw new BadRequestException(
        `Cannot cancel order: current status is ${order.status}. Kitchen preparation has already commenced.`,
      );
    }

    // Atomic conditional update preventing race conditions
    const updated = await this.orderModel.findOneAndUpdate(
      {
        _id: order._id,
        status: OrderStatus.PLACED,
      },
      {
        $set: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: dto.reason?.trim() || 'Cancelled by customer',
          cancelledBy: 'CUSTOMER',
        },
      },
      { new: true },
    ).populate<{ tableId: RestaurantTableDocument }>('tableId');

    if (!updated) {
      throw new ConflictException('Order status was modified concurrently');
    }

    const responseDto = this.toResponseDto(updated, (updated.tableId as any)?.tableNumber, true);
    this.orderEventsService.emitOrderEvent('ORDER_CANCELLED', responseDto);
    return responseDto;
  }

  /**
   * Staff/Admin: Lists all restaurant orders with optional status filter.
   */
  async getRestaurantOrders(
    restaurantId: string,
    status?: OrderStatus,
    limit = 50,
  ): Promise<OrderResponseDto[]> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const filter: Record<string, unknown> = { restaurantId: rId };
    if (status) {
      filter.status = status;
    }

    const orders = await this.orderModel
      .find(filter)
      .populate<{ tableId: RestaurantTableDocument }>('tableId')
      .sort({ createdAt: -1 })
      .limit(limit);

    return orders.map((o) =>
      this.toResponseDto(o, (o.tableId as any)?.tableNumber, false),
    );
  }

  /**
   * Staff/KDS: Returns active kitchen queue in FIFO order.
   * Statuses: PLACED, CONFIRMED, PREPARING, READY.
   */
  async getKitchenQueue(restaurantId: string): Promise<OrderResponseDto[]> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const orders = await this.orderModel
      .find({
        restaurantId: rId,
        status: {
          $in: [
            OrderStatus.PLACED,
            OrderStatus.CONFIRMED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
          ],
        },
      })
      .populate<{ tableId: RestaurantTableDocument }>('tableId')
      .sort({ placedAt: 1 }); // FIFO: oldest orders first for kitchen display

    return orders.map((o) =>
      this.toResponseDto(o, (o.tableId as any)?.tableNumber, false),
    );
  }

  /**
   * Staff/Admin: Retrieves single order by ID with tenant verification.
   */
  async getOrderById(restaurantId: string, orderId: string): Promise<OrderResponseDto> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const oId = TenantHelper.toObjectId(orderId);

    const order = await this.orderModel
      .findOne({ _id: oId, restaurantId: rId })
      .populate<{ tableId: RestaurantTableDocument }>('tableId');

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.toResponseDto(order, (order.tableId as any)?.tableNumber, false);
  }

  /**
   * Centralized Order Lifecycle State Machine:
   * Validates legal sequential transitions and role permissions.
   * Transitions:
   * PLACED -> CONFIRMED
   * CONFIRMED -> PREPARING
   * PREPARING -> READY
   * READY -> SERVED
   * (PLACED | CONFIRMED | PREPARING) -> CANCELLED
   */
  async updateOrderStatus(
    restaurantId: string,
    orderId: string,
    targetStatus: OrderStatus,
    actorRoles: UserRole[] = [],
    actorEmail = 'STAFF',
  ): Promise<OrderResponseDto> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const oId = TenantHelper.toObjectId(orderId);

    const order = await this.orderModel
      .findOne({ _id: oId, restaurantId: rId })
      .populate<{ tableId: RestaurantTableDocument }>('tableId');

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const currentStatus = order.status;

    // 1. Validate State Machine Transitions
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PLACED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [OrderStatus.SERVED],
      [OrderStatus.SERVED]: [], // Terminal fulfillment
      [OrderStatus.PAID]: [],
      [OrderStatus.CANCELLED]: [], // Terminal cancellation
    };

    const validTargets = allowedTransitions[currentStatus] || [];
    if (!validTargets.includes(targetStatus)) {
      throw new BadRequestException(
        `Illegal order status transition: cannot transition from ${currentStatus} to ${targetStatus}`,
      );
    }

    // 2. Validate Actor Role Permissions
    const isSuperAdmin = actorRoles.includes(UserRole.SUPER_ADMIN);
    const isRestaurantAdmin = actorRoles.includes(UserRole.RESTAURANT_ADMIN);
    const isKitchenStaff = actorRoles.includes(UserRole.KITCHEN_STAFF);
    const isWaiter = actorRoles.includes(UserRole.WAITER);

    if (!isSuperAdmin && !isRestaurantAdmin) {
      if (isKitchenStaff && targetStatus === OrderStatus.SERVED) {
        throw new ForbiddenException(
          'Kitchen staff cannot mark orders as SERVED (requires Waiter or Admin role)',
        );
      }
      if (
        isWaiter &&
        (targetStatus === OrderStatus.PREPARING || targetStatus === OrderStatus.READY)
      ) {
        throw new ForbiddenException(
          'Waiters cannot advance kitchen preparation states (requires Kitchen Staff or Admin)',
        );
      }
    }

    // 3. Prepare Timestamp Updates
    const now = new Date();
    const updateFields: Record<string, unknown> = {
      status: targetStatus,
    };

    if (targetStatus === OrderStatus.CONFIRMED) {
      updateFields.confirmedAt = now;
    } else if (targetStatus === OrderStatus.PREPARING) {
      updateFields.preparedAt = now;
    } else if (targetStatus === OrderStatus.READY) {
      updateFields.readyAt = now;
    } else if (targetStatus === OrderStatus.SERVED) {
      updateFields.servedAt = now;
    } else if (targetStatus === OrderStatus.CANCELLED) {
      updateFields.cancelledAt = now;
      updateFields.cancellationReason = 'Cancelled by staff';
      updateFields.cancelledBy = actorEmail;
    }

    // 4. Concurrency-Safe Atomic Transition
    const updated = await this.orderModel.findOneAndUpdate(
      {
        _id: oId,
        restaurantId: rId,
        status: currentStatus, // Optimistic concurrency check
      },
      {
        $set: updateFields,
      },
      { new: true },
    ).populate<{ tableId: RestaurantTableDocument }>('tableId');

    if (!updated) {
      throw new ConflictException(
        'Order status was updated concurrently by another staff member',
      );
    }

    const responseDto = this.toResponseDto(
      updated,
      (updated.tableId as any)?.tableNumber,
      false,
    );

    this.orderEventsService.emitOrderEvent('ORDER_UPDATED', responseDto);
    return responseDto;
  }

  /**
   * Staff/Admin cancellation with custom reason.
   */
  async cancelStaffOrder(
    restaurantId: string,
    orderId: string,
    dto: CancelOrderDto,
    actorEmail: string,
  ): Promise<OrderResponseDto> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const oId = TenantHelper.toObjectId(orderId);

    const order = await this.orderModel.findOne({ _id: oId, restaurantId: rId });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      order.status === OrderStatus.READY ||
      order.status === OrderStatus.SERVED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel order with current status: ${order.status}`,
      );
    }

    const updated = await this.orderModel.findOneAndUpdate(
      {
        _id: oId,
        restaurantId: rId,
        status: order.status,
      },
      {
        $set: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: dto.reason?.trim() || 'Cancelled by staff',
          cancelledBy: actorEmail,
        },
      },
      { new: true },
    ).populate<{ tableId: RestaurantTableDocument }>('tableId');

    if (!updated) {
      throw new ConflictException('Order status was modified concurrently');
    }

    const responseDto = this.toResponseDto(
      updated,
      (updated.tableId as any)?.tableNumber,
      false,
    );

    this.orderEventsService.emitOrderEvent('ORDER_CANCELLED', responseDto);
    return responseDto;
  }
}
