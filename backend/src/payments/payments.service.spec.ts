import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderStatus, PaymentStatus } from '../database/schemas/order.schema.js';
import { PaymentTransactionStatus } from '../database/schemas/payment-transaction.schema.js';
import { PaymentsService } from './payments.service.js';
import { SandboxPaymentGateway } from './providers/sandbox-payment-gateway.js';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockPaymentModel: any;
  let mockOrderModel: any;
  let mockRestaurantModel: any;
  let mockSandboxGateway: any;
  let mockOrderEventsService: any;

  const restaurantId = new Types.ObjectId();
  const orderId = new Types.ObjectId();
  const validTrackingToken = 'tok_track_12345';
  const orderRef = 'ORD-20261012-001';

  beforeEach(() => {
    function MockPaymentModel(this: any, dto: any) {
      Object.assign(this, dto);
      this._id = new Types.ObjectId();
      this.save = vi.fn().mockResolvedValue({
        ...dto,
        _id: this._id,
        createdAt: new Date(),
      });
    }
    MockPaymentModel.findOne = vi.fn();
    MockPaymentModel.find = vi.fn();
    MockPaymentModel.findById = vi.fn();
    mockPaymentModel = MockPaymentModel;

    mockOrderModel = {
      findOne: vi.fn(),
      findById: vi.fn(),
    };

    mockRestaurantModel = {
      findOne: vi.fn(),
    };

    mockSandboxGateway = {
      providerName: 'sandbox',
      createPaymentIntent: vi.fn().mockResolvedValue({
        providerOrderId: 'sbx_ord_1',
        providerPaymentId: 'sbx_pay_1',
        status: PaymentTransactionStatus.PENDING,
        clientSecret: 'sbx_sec_1',
        checkoutUrl: 'https://sandbox.checkout',
      }),
      verifyPayment: vi.fn().mockResolvedValue({
        status: PaymentTransactionStatus.SUCCESS,
        providerPaymentId: 'sbx_pay_verified_1',
      }),
      verifyWebhookSignature: vi.fn(),
    };

    mockOrderEventsService = {
      emitOrderEvent: vi.fn(),
    };

    service = new PaymentsService(
      mockPaymentModel as any,
      mockOrderModel as any,
      mockRestaurantModel as any,
      mockSandboxGateway as unknown as SandboxPaymentGateway,
      mockOrderEventsService as any,
    );
  });

  describe('initiateCustomerPayment', () => {
    it('should reject if restaurant is not found', async () => {
      mockRestaurantModel.findOne.mockResolvedValue(null);

      await expect(
        service.initiateCustomerPayment('bad-slug', orderRef, validTrackingToken, {
          idempotencyKey: 'idemp_1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if tracking token does not match', async () => {
      mockRestaurantModel.findOne.mockResolvedValue({ _id: restaurantId, currency: 'INR' });
      mockOrderModel.findOne.mockResolvedValue({
        _id: orderId,
        trackingToken: 'wrong_token',
        status: OrderStatus.PLACED,
        paymentStatus: PaymentStatus.PENDING,
      });

      await expect(
        service.initiateCustomerPayment('slug', orderRef, 'bad_token', {
          idempotencyKey: 'idemp_1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if order is cancelled', async () => {
      mockRestaurantModel.findOne.mockResolvedValue({ _id: restaurantId, currency: 'INR' });
      mockOrderModel.findOne.mockResolvedValue({
        _id: orderId,
        trackingToken: validTrackingToken,
        status: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.PENDING,
      });

      await expect(
        service.initiateCustomerPayment('slug', orderRef, validTrackingToken, {
          idempotencyKey: 'idemp_1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if order is already paid', async () => {
      mockRestaurantModel.findOne.mockResolvedValue({ _id: restaurantId, currency: 'INR' });
      mockOrderModel.findOne.mockResolvedValue({
        _id: orderId,
        trackingToken: validTrackingToken,
        status: OrderStatus.SERVED,
        paymentStatus: PaymentStatus.PAID,
      });

      await expect(
        service.initiateCustomerPayment('slug', orderRef, validTrackingToken, {
          idempotencyKey: 'idemp_1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should return existing transaction on matching idempotency key', async () => {
      mockRestaurantModel.findOne.mockResolvedValue({ _id: restaurantId, currency: 'INR' });
      mockOrderModel.findOne.mockResolvedValue({
        _id: orderId,
        trackingToken: validTrackingToken,
        status: OrderStatus.PLACED,
        paymentStatus: PaymentStatus.PENDING,
        grandTotal: 500,
      });

      const existingTx = {
        transactionReference: 'PAY-EXISTING',
        orderId,
        restaurantId,
        amount: 500,
        currency: 'INR',
        status: PaymentTransactionStatus.PENDING,
        provider: 'sandbox',
        idempotencyKey: 'idemp_existing',
      };
      mockPaymentModel.findOne.mockResolvedValue(existingTx);

      const res = await service.initiateCustomerPayment('slug', orderRef, validTrackingToken, {
        idempotencyKey: 'idemp_existing',
      });

      expect(res.transactionReference).toBe('PAY-EXISTING');
      expect(mockSandboxGateway.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('should create new payment intent and record transaction in PENDING status', async () => {
      mockRestaurantModel.findOne.mockResolvedValue({ _id: restaurantId, currency: 'INR' });
      mockOrderModel.findOne.mockResolvedValue({
        _id: orderId,
        trackingToken: validTrackingToken,
        status: OrderStatus.PLACED,
        paymentStatus: PaymentStatus.PENDING,
        grandTotal: 714,
      });
      mockPaymentModel.findOne.mockResolvedValue(null);

      const res = await service.initiateCustomerPayment('slug', orderRef, validTrackingToken, {
        idempotencyKey: 'idemp_new_1',
      });

      expect(res.amount).toBe(714);
      expect(res.status).toBe(PaymentTransactionStatus.PENDING);
      expect(res.clientSecret).toBe('sbx_sec_1');
      expect(mockSandboxGateway.createPaymentIntent).toHaveBeenCalled();
    });
  });

  describe('confirmCustomerPayment', () => {
    it('should authoritatively verify payment, update order to PAID, and emit event', async () => {
      mockRestaurantModel.findOne.mockResolvedValue({ _id: restaurantId });
      const orderDoc = {
        _id: orderId,
        restaurantId,
        tableId: new Types.ObjectId(),
        orderNumber: 'ORD-001',
        trackingToken: validTrackingToken,
        status: OrderStatus.SERVED,
        paymentStatus: PaymentStatus.PENDING,
        items: [],
        grandTotal: 714,
        subtotal: 680,
        taxAmount: 34,
        discountAmount: 0,
        placedAt: new Date(),
        save: vi.fn().mockResolvedValue(true),
      };
      mockOrderModel.findOne.mockResolvedValue(orderDoc);

      const paymentDoc = {
        transactionReference: 'PAY-123',
        orderId,
        restaurantId,
        amount: 714,
        currency: 'INR',
        status: PaymentTransactionStatus.PENDING,
        provider: 'sandbox',
        save: vi.fn().mockResolvedValue(true),
      };
      mockPaymentModel.findOne.mockResolvedValue(paymentDoc);

      const result = await service.confirmCustomerPayment('slug', orderRef, validTrackingToken, {
        transactionReference: 'PAY-123',
      });

      expect(result.status).toBe(PaymentTransactionStatus.SUCCESS);
      expect(orderDoc.paymentStatus).toBe(PaymentStatus.PAID);
      expect(orderDoc.status).toBe(OrderStatus.PAID);
      expect(orderDoc.save).toHaveBeenCalled();
      expect(mockOrderEventsService.emitOrderEvent).toHaveBeenCalledWith(
        'ORDER_UPDATED',
        expect.anything(),
        validTrackingToken,
      );
    });
  });

  describe('handleWebhook replay protection', () => {
    it('should reject invalid webhook signature', async () => {
      mockSandboxGateway.verifyWebhookSignature.mockResolvedValue({
        isValid: false,
        failureReason: 'Signature mismatch',
      });

      await expect(
        service.handleWebhook('{}', 'bad_sig'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should acknowledge without re-processing if already in terminal SUCCESS state', async () => {
      mockSandboxGateway.verifyWebhookSignature.mockResolvedValue({
        isValid: true,
        transactionReference: 'PAY-123',
        status: PaymentTransactionStatus.SUCCESS,
      });

      mockPaymentModel.findOne.mockResolvedValue({
        transactionReference: 'PAY-123',
        status: PaymentTransactionStatus.SUCCESS,
      });

      const res = await service.handleWebhook('{}', 'good_sig');
      expect(res).toEqual({ received: true, status: 'already_processed' });
    });
  });
});
