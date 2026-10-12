import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionStatus } from '../database/schemas/dining-session.schema.js';
import {
  AvailabilityStatus,
  MenuItemPublicationStatus,
} from '../database/schemas/menu-item.schema.js';
import {
  OrderStatus,
  PaymentStatus,
} from '../database/schemas/order.schema.js';
import { PublicationStatus } from '../database/schemas/restaurant.schema.js';
import { TableStatus } from '../database/schemas/restaurant-table.schema.js';
import { UserRole } from '../database/schemas/user.schema.js';
import { OrdersService } from './orders.service.js';

describe('OrdersService', () => {
  let service: OrdersService;
  let mockOrderModel: any;
  let mockRestaurantModel: any;
  let mockTableModel: any;
  let mockMenuItemModel: any;
  let mockDiningSessionsService: any;
  let mockOrderEventsService: any;

  const validRestaurantId = new Types.ObjectId();
  const validTableId = new Types.ObjectId();
  const validDiningSessionId = new Types.ObjectId();
  const validDishId = new Types.ObjectId();

  const mockRestaurantDoc = {
    _id: validRestaurantId,
    slug: 'le-bistro',
    name: 'Le Bistro',
    publicationStatus: PublicationStatus.PUBLISHED,
  };

  const mockTableDoc = {
    _id: validTableId,
    restaurantId: validRestaurantId,
    tableToken: 'tbl_secret_token_123',
    tableNumber: 'Table 5',
    status: TableStatus.OCCUPIED,
  };

  const mockMenuItemDoc = {
    _id: validDishId,
    restaurantId: validRestaurantId,
    name: 'Truffle Pasta',
    price: 450.0,
    publicationStatus: MenuItemPublicationStatus.PUBLISHED,
    availabilityStatus: AvailabilityStatus.AVAILABLE,
    isArchived: false,
  };

  beforeEach(() => {
    function MockOrderInstance(this: any, data: any) {
      Object.assign(this, data);
      this._id = data._id || new Types.ObjectId();
      this.save = vi.fn().mockResolvedValue(this);
    }

    mockOrderModel = MockOrderInstance as any;
    mockOrderModel.findOne = vi.fn().mockImplementation(() => {
      const promise: any = Promise.resolve(null);
      promise.populate = vi.fn().mockResolvedValue(null);
      return promise;
    });
    mockOrderModel.find = vi.fn();
    mockOrderModel.findOneAndUpdate = vi.fn();

    mockRestaurantModel = {
      findOne: vi.fn(),
      findById: vi.fn(),
    };

    mockTableModel = {
      findOne: vi.fn(),
      findById: vi.fn(),
    };

    mockMenuItemModel = {
      findById: vi.fn(),
      find: vi.fn(),
    };

    mockDiningSessionsService = {
      validateSession: vi.fn(),
    };

    mockOrderEventsService = {
      emitOrderEvent: vi.fn(),
      streamForRestaurant: vi.fn(),
      streamForOrder: vi.fn(),
    };

    service = new OrdersService(
      mockOrderModel,
      mockRestaurantModel,
      mockTableModel,
      mockMenuItemModel,
      mockDiningSessionsService,
      mockOrderEventsService,
    );
  });

  describe('createOrder', () => {
    it('creates an order with authoritative pricing, 5% tax, and correct totals', async () => {
      mockRestaurantModel.findOne.mockResolvedValue(mockRestaurantDoc);
      mockDiningSessionsService.validateSession.mockResolvedValue({
        id: validDiningSessionId.toString(),
        restaurantId: validRestaurantId.toString(),
        tableId: validTableId.toString(),
        sessionToken: 'ds_valid_token_xyz',
        status: SessionStatus.ACTIVE,
      });
      mockTableModel.findOne.mockResolvedValue(mockTableDoc);
      mockMenuItemModel.findById.mockResolvedValue(mockMenuItemDoc);

      // Order creation
      const result = await service.createOrder('le-bistro', 'tbl_secret_token_123', {
        sessionToken: 'ds_valid_token_xyz',
        items: [
          {
            menuItemId: validDishId.toString(),
            quantity: 2,
            specialInstructions: 'Extra sauce',
          },
        ],
        idempotencyKey: 'idemp-key-001',
      });

      expect(result).toBeDefined();
      expect(result.orderNumber).toMatch(/^ORD-\d{8}-[A-Z0-9]+$/);
      expect(result.trackingToken).toMatch(/^trk_[a-f0-9]{32}$/);
      expect(result.subtotal).toBe(900); // 450 * 2
      expect(result.taxAmount).toBe(45); // 5% of 900
      expect(result.grandTotal).toBe(945); // 900 + 45
      expect(result.status).toBe(OrderStatus.PLACED);
      expect(result.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Truffle Pasta');
      expect(result.items[0].unitPrice).toBe(450);
      expect(mockOrderEventsService.emitOrderEvent).toHaveBeenCalledWith(
        'ORDER_PLACED',
        expect.anything(),
      );
    });

    it('returns existing order when the same idempotency key is submitted with matching payload', async () => {
      mockRestaurantModel.findOne.mockResolvedValue(mockRestaurantDoc);

      const existingOrder = {
        _id: new Types.ObjectId(),
        restaurantId: validRestaurantId,
        tableId: mockTableDoc,
        orderNumber: 'ORD-20261012-ABC1',
        trackingToken: 'trk_existing_1234567890abcdef',
        subtotal: 450,
        taxAmount: 22.5,
        discountAmount: 0,
        grandTotal: 472.5,
        status: OrderStatus.PLACED,
        paymentStatus: PaymentStatus.PENDING,
        items: [
          {
            menuItemId: validDishId,
            name: 'Truffle Pasta',
            unitPrice: 450,
            quantity: 1,
            subtotal: 450,
          },
        ],
      };

      const populateMock = vi.fn().mockResolvedValue(existingOrder);
      mockOrderModel.findOne = vi.fn().mockReturnValue({
        populate: populateMock,
      });

      const result = await service.createOrder('le-bistro', 'tbl_secret_token_123', {
        sessionToken: 'ds_valid_token_xyz',
        items: [{ menuItemId: validDishId.toString(), quantity: 1 }],
        idempotencyKey: 'dup-key-001',
      });

      expect(result.orderNumber).toBe('ORD-20261012-ABC1');
      expect(result.grandTotal).toBe(472.5);
      expect(mockDiningSessionsService.validateSession).not.toHaveBeenCalled();
    });

    it('rejects duplicate submission with same idempotency key but conflicting payload (409 Conflict)', async () => {
      mockRestaurantModel.findOne.mockResolvedValue(mockRestaurantDoc);

      const existingOrder = {
        _id: new Types.ObjectId(),
        restaurantId: validRestaurantId,
        tableId: mockTableDoc,
        orderNumber: 'ORD-20261012-ABC1',
        items: [
          {
            menuItemId: validDishId,
            quantity: 1,
          },
        ],
      };

      const populateMock = vi.fn().mockResolvedValue(existingOrder);
      mockOrderModel.findOne = vi.fn().mockReturnValue({
        populate: populateMock,
      });

      await expect(
        service.createOrder('le-bistro', 'tbl_secret_token_123', {
          sessionToken: 'ds_valid_token_xyz',
          items: [{ menuItemId: validDishId.toString(), quantity: 3 }], // conflicting quantity!
          idempotencyKey: 'dup-key-001',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects order when dining session is invalid or expired', async () => {
      mockRestaurantModel.findOne.mockResolvedValue(mockRestaurantDoc);
      mockDiningSessionsService.validateSession.mockRejectedValue(
        new UnauthorizedException('Dining session has expired'),
      );

      await expect(
        service.createOrder('le-bistro', 'tbl_secret_token_123', {
          sessionToken: 'ds_expired_token',
          items: [{ menuItemId: validDishId.toString(), quantity: 1 }],
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects order when dish is out of stock', async () => {
      mockRestaurantModel.findOne.mockResolvedValue(mockRestaurantDoc);
      mockDiningSessionsService.validateSession.mockResolvedValue({
        id: validDiningSessionId.toString(),
        restaurantId: validRestaurantId.toString(),
        tableId: validTableId.toString(),
        sessionToken: 'ds_valid_token_xyz',
        status: SessionStatus.ACTIVE,
      });
      mockTableModel.findOne.mockResolvedValue(mockTableDoc);

      const outOfStockDish = {
        ...mockMenuItemDoc,
        availabilityStatus: AvailabilityStatus.OUT_OF_STOCK,
      };
      mockMenuItemModel.findById.mockResolvedValue(outOfStockDish);

      await expect(
        service.createOrder('le-bistro', 'tbl_secret_token_123', {
          sessionToken: 'ds_valid_token_xyz',
          items: [{ menuItemId: validDishId.toString(), quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects order when dish belongs to another restaurant tenant', async () => {
      mockRestaurantModel.findOne.mockResolvedValue(mockRestaurantDoc);
      mockDiningSessionsService.validateSession.mockResolvedValue({
        id: validDiningSessionId.toString(),
        restaurantId: validRestaurantId.toString(),
        tableId: validTableId.toString(),
        sessionToken: 'ds_valid_token_xyz',
        status: SessionStatus.ACTIVE,
      });
      mockTableModel.findOne.mockResolvedValue(mockTableDoc);

      const crossTenantDish = {
        ...mockMenuItemDoc,
        restaurantId: new Types.ObjectId(), // Different tenant!
      };
      mockMenuItemModel.findById.mockResolvedValue(crossTenantDish);

      await expect(
        service.createOrder('le-bistro', 'tbl_secret_token_123', {
          sessionToken: 'ds_valid_token_xyz',
          items: [{ menuItemId: validDishId.toString(), quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Order Lifecycle State Machine', () => {
    it('allows valid sequential transition: PLACED -> CONFIRMED', async () => {
      const orderId = new Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        restaurantId: validRestaurantId,
        status: OrderStatus.PLACED,
        trackingToken: 'trk_mock_token',
        tableId: mockTableDoc,
        items: [],
      };

      mockOrderModel.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockOrder),
      });

      const updatedOrder = {
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
        confirmedAt: new Date(),
      };

      mockOrderModel.findOneAndUpdate.mockReturnValue({
        populate: vi.fn().mockResolvedValue(updatedOrder),
      });

      const result = await service.updateOrderStatus(
        validRestaurantId.toString(),
        orderId.toString(),
        OrderStatus.CONFIRMED,
        [UserRole.RESTAURANT_ADMIN],
        'admin@restaurant.com',
      );

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(mockOrderEventsService.emitOrderEvent).toHaveBeenCalledWith(
        'ORDER_UPDATED',
        expect.anything(),
        'trk_mock_token',
      );
    });

    it('rejects illegal status jump: PLACED -> SERVED', async () => {
      const orderId = new Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        restaurantId: validRestaurantId,
        status: OrderStatus.PLACED,
        tableId: mockTableDoc,
        items: [],
      };

      mockOrderModel.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockOrder),
      });

      await expect(
        service.updateOrderStatus(
          validRestaurantId.toString(),
          orderId.toString(),
          OrderStatus.SERVED,
          [UserRole.RESTAURANT_ADMIN],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects transition from terminal SERVED status', async () => {
      const orderId = new Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        restaurantId: validRestaurantId,
        status: OrderStatus.SERVED,
        tableId: mockTableDoc,
        items: [],
      };

      mockOrderModel.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockOrder),
      });

      await expect(
        service.updateOrderStatus(
          validRestaurantId.toString(),
          orderId.toString(),
          OrderStatus.CANCELLED,
          [UserRole.RESTAURANT_ADMIN],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects kitchen staff attempting to mark order SERVED (waiter/admin only)', async () => {
      const orderId = new Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        restaurantId: validRestaurantId,
        status: OrderStatus.READY,
        tableId: mockTableDoc,
        items: [],
      };

      mockOrderModel.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockOrder),
      });

      await expect(
        service.updateOrderStatus(
          validRestaurantId.toString(),
          orderId.toString(),
          OrderStatus.SERVED,
          [UserRole.KITCHEN_STAFF],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects waiter attempting to advance to PREPARING (kitchen/admin only)', async () => {
      const orderId = new Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        restaurantId: validRestaurantId,
        status: OrderStatus.CONFIRMED,
        tableId: mockTableDoc,
        items: [],
      };

      mockOrderModel.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockOrder),
      });

      await expect(
        service.updateOrderStatus(
          validRestaurantId.toString(),
          orderId.toString(),
          OrderStatus.PREPARING,
          [UserRole.WAITER],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows waiter or admin to transition SERVED order to PAID with completedAt and paymentStatus', async () => {
      const orderId = new Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        restaurantId: validRestaurantId,
        status: OrderStatus.SERVED,
        paymentStatus: PaymentStatus.PENDING,
        tableId: mockTableDoc,
        items: [],
      };

      mockOrderModel.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockOrder),
      });

      const updatedOrder = {
        ...mockOrder,
        status: OrderStatus.PAID,
        paymentStatus: PaymentStatus.PAID,
        completedAt: new Date(),
      };

      mockOrderModel.findOneAndUpdate.mockReturnValue({
        populate: vi.fn().mockResolvedValue(updatedOrder),
      });

      const result = await service.updateOrderStatus(
        validRestaurantId.toString(),
        orderId.toString(),
        OrderStatus.PAID,
        [UserRole.WAITER],
      );

      expect(result.status).toBe(OrderStatus.PAID);
      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: orderId,
          restaurantId: validRestaurantId,
          status: OrderStatus.SERVED,
        },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: OrderStatus.PAID,
            paymentStatus: PaymentStatus.PAID,
            completedAt: expect.any(Date),
          }),
        }),
        expect.anything(),
      );
    });

    it('rejects kitchen staff attempting to transition SERVED order to PAID (403 Forbidden)', async () => {
      const orderId = new Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        restaurantId: validRestaurantId,
        status: OrderStatus.SERVED,
        tableId: mockTableDoc,
        items: [],
      };

      mockOrderModel.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockOrder),
      });

      await expect(
        service.updateOrderStatus(
          validRestaurantId.toString(),
          orderId.toString(),
          OrderStatus.PAID,
          [UserRole.KITCHEN_STAFF],
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Customer Tracking & Cancellation', () => {
    it('retrieves order tracking when provided with matching trackingToken', async () => {
      mockRestaurantModel.findOne.mockResolvedValue(mockRestaurantDoc);

      const mockOrder = {
        _id: new Types.ObjectId(),
        restaurantId: validRestaurantId,
        orderNumber: 'ORD-20261012-TRACK',
        trackingToken: 'trk_secret_abc123',
        status: OrderStatus.PREPARING,
        tableId: mockTableDoc,
        items: [],
      };

      mockOrderModel.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockOrder),
      });

      const result = await service.getPublicOrderTracking(
        'le-bistro',
        'ORD-20261012-TRACK',
        'trk_secret_abc123',
      );

      expect(result.orderNumber).toBe('ORD-20261012-TRACK');
      expect(result.status).toBe(OrderStatus.PREPARING);
    });

    it('rejects customer tracking when trackingToken does not match', async () => {
      mockRestaurantModel.findOne.mockResolvedValue(mockRestaurantDoc);

      const mockOrder = {
        _id: new Types.ObjectId(),
        restaurantId: validRestaurantId,
        orderNumber: 'ORD-20261012-TRACK',
        trackingToken: 'trk_real_secret',
        status: OrderStatus.PREPARING,
        tableId: mockTableDoc,
        items: [],
      };

      mockOrderModel.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockOrder),
      });

      await expect(
        service.getPublicOrderTracking(
          'le-bistro',
          'ORD-20261012-TRACK',
          'trk_wrong_token',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows guest to cancel order while status is PLACED', async () => {
      mockRestaurantModel.findOne.mockResolvedValue(mockRestaurantDoc);

      const orderId = new Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        restaurantId: validRestaurantId,
        orderNumber: 'ORD-20261012-CANCEL',
        trackingToken: 'trk_cancel_token',
        status: OrderStatus.PLACED,
        tableId: mockTableDoc,
        items: [],
      };

      mockOrderModel.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockOrder),
      });

      const cancelledOrder = {
        ...mockOrder,
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: 'Customer changed mind',
        cancelledBy: 'CUSTOMER',
      };

      mockOrderModel.findOneAndUpdate.mockReturnValue({
        populate: vi.fn().mockResolvedValue(cancelledOrder),
      });

      const result = await service.cancelPublicOrder(
        'le-bistro',
        'ORD-20261012-CANCEL',
        'trk_cancel_token',
        { reason: 'Customer changed mind' },
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(result.cancelledBy).toBe('CUSTOMER');
      expect(mockOrderEventsService.emitOrderEvent).toHaveBeenCalledWith(
        'ORDER_CANCELLED',
        expect.anything(),
      );
    });

    it('rejects guest cancellation if kitchen preparation has already started', async () => {
      mockRestaurantModel.findOne.mockResolvedValue(mockRestaurantDoc);

      const mockOrder = {
        _id: new Types.ObjectId(),
        restaurantId: validRestaurantId,
        orderNumber: 'ORD-20261012-CANCEL',
        trackingToken: 'trk_cancel_token',
        status: OrderStatus.PREPARING,
        tableId: mockTableDoc,
        items: [],
      };

      mockOrderModel.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockOrder),
      });

      await expect(
        service.cancelPublicOrder(
          'le-bistro',
          'ORD-20261012-CANCEL',
          'trk_cancel_token',
          { reason: 'Too late' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Kitchen Queue & Staff Operations', () => {
    it('returns active kitchen queue in FIFO order', async () => {
      const mockOrders = [
        {
          _id: new Types.ObjectId(),
          restaurantId: validRestaurantId,
          orderNumber: 'ORD-20261012-001',
          status: OrderStatus.PLACED,
          tableId: mockTableDoc,
          placedAt: new Date(Date.now() - 600000),
          items: [],
        },
        {
          _id: new Types.ObjectId(),
          restaurantId: validRestaurantId,
          orderNumber: 'ORD-20261012-002',
          status: OrderStatus.PREPARING,
          tableId: mockTableDoc,
          placedAt: new Date(Date.now() - 300000),
          items: [],
        },
      ];

      const populateMock = vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockOrders),
      });

      mockOrderModel.find.mockReturnValue({
        populate: populateMock,
      });

      const queue = await service.getKitchenQueue(validRestaurantId.toString());
      expect(queue).toHaveLength(2);
      expect(queue[0].orderNumber).toBe('ORD-20261012-001');
      expect(queue[1].orderNumber).toBe('ORD-20261012-002');
    });

    it('enforces safe upper bound (max 100) on getRestaurantOrders limit', async () => {
      const limitMock = vi.fn().mockResolvedValue([]);
      const sortMock = vi.fn().mockReturnValue({ limit: limitMock });
      const populateMock = vi.fn().mockReturnValue({ sort: sortMock });
      mockOrderModel.find.mockReturnValue({ populate: populateMock });

      await service.getRestaurantOrders(validRestaurantId.toString(), undefined, 500);
      expect(limitMock).toHaveBeenCalledWith(100); // Bounded to 100!
    });

    it('allows staff to cancel order with custom reason and records staff email', async () => {
      const orderId = new Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        restaurantId: validRestaurantId,
        orderNumber: 'ORD-20261012-CANCEL',
        status: OrderStatus.PREPARING,
        tableId: mockTableDoc,
        trackingToken: 'trk_staff_cancel',
      };

      mockOrderModel.findOne.mockResolvedValue(mockOrder);

      const cancelledOrder = {
        ...mockOrder,
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: 'Chef 86 item',
        cancelledBy: 'chef@restaurant.com',
      };

      mockOrderModel.findOneAndUpdate.mockReturnValue({
        populate: vi.fn().mockResolvedValue(cancelledOrder),
      });

      const result = await service.cancelStaffOrder(
        validRestaurantId.toString(),
        orderId.toString(),
        { reason: 'Chef 86 item' },
        'chef@restaurant.com',
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(result.cancelledBy).toBe('chef@restaurant.com');
      expect(mockOrderEventsService.emitOrderEvent).toHaveBeenCalledWith(
        'ORDER_CANCELLED',
        expect.anything(),
        'trk_staff_cancel',
      );
    });

    it('rejects staff cancellation on orders that are already READY or SERVED', async () => {
      const orderId = new Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        restaurantId: validRestaurantId,
        status: OrderStatus.READY,
      };

      mockOrderModel.findOne.mockResolvedValue(mockOrder);

      await expect(
        service.cancelStaffOrder(
          validRestaurantId.toString(),
          orderId.toString(),
          { reason: 'Too late' },
          'staff@restaurant.com',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException (409) when concurrent status transition is detected', async () => {
      const orderId = new Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        restaurantId: validRestaurantId,
        status: OrderStatus.PLACED,
        tableId: mockTableDoc,
        items: [],
      };

      mockOrderModel.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockOrder),
      });

      // findOneAndUpdate returns null because status changed concurrently
      mockOrderModel.findOneAndUpdate.mockReturnValue({
        populate: vi.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateOrderStatus(
          validRestaurantId.toString(),
          orderId.toString(),
          OrderStatus.CONFIRMED,
          [UserRole.RESTAURANT_ADMIN],
          'admin@restaurant.com',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
