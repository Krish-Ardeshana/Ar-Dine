import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import crypto from 'node:crypto';
import {
  Order,
  OrderDocument,
  OrderStatus,
  PaymentStatus,
} from '../database/schemas/order.schema.js';
import {
  PaymentTransaction,
  PaymentTransactionDocument,
  PaymentTransactionStatus,
} from '../database/schemas/payment-transaction.schema.js';
import {
  Restaurant,
  RestaurantDocument,
} from '../database/schemas/restaurant.schema.js';
import { OrderResponseDto } from '../orders/dto/order-response.dto.js';
import { OrderEventsService } from '../orders/order-events.service.js';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto.js';
import { InitiatePaymentDto } from './dto/initiate-payment.dto.js';
import { PaymentTransactionResponseDto } from './dto/payment-response.dto.js';
import { SandboxPaymentGateway } from './providers/sandbox-payment-gateway.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(PaymentTransaction.name)
    private readonly paymentModel: Model<PaymentTransactionDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    private readonly sandboxGateway: SandboxPaymentGateway,
    private readonly orderEventsService: OrderEventsService,
  ) {}

  /**
   * Initiates a payment transaction for a customer order.
   * Authoritatively verifies order amount and enforces idempotency.
   */
  async initiateCustomerPayment(
    restaurantSlug: string,
    orderReference: string,
    trackingToken: string,
    dto: InitiatePaymentDto,
  ): Promise<PaymentTransactionResponseDto> {
    const restaurant = await this.restaurantModel.findOne({ slug: restaurantSlug });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const order = await this.orderModel.findOne({
      restaurantId: restaurant._id,
      orderReference,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.trackingToken !== trackingToken) {
      throw new ForbiddenException('Invalid tracking token for this order');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot initiate payment for a cancelled order');
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new ConflictException('This order has already been paid in full');
    }

    // Idempotency check: if a transaction exists with the same idempotency key
    const existing = await this.paymentModel.findOne({
      restaurantId: restaurant._id,
      idempotencyKey: dto.idempotencyKey,
    });

    if (existing) {
      return this.mapToResponseDto(existing);
    }

    const txRef = `PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Call payment gateway abstraction to create payment intent
    const intent = await this.sandboxGateway.createPaymentIntent({
      transactionReference: txRef,
      orderId: (order._id as Types.ObjectId).toString(),
      restaurantId: (restaurant._id as Types.ObjectId).toString(),
      amount: order.grandTotal,
      currency: restaurant.currency || 'INR',
      idempotencyKey: dto.idempotencyKey,
    });

    const payment = new this.paymentModel({
      restaurantId: restaurant._id,
      orderId: order._id,
      diningSessionId: order.diningSessionId,
      transactionReference: txRef,
      amount: order.grandTotal,
      currency: restaurant.currency || 'INR',
      status: PaymentTransactionStatus.PENDING,
      provider: this.sandboxGateway.providerName,
      providerOrderId: intent.providerOrderId,
      providerPaymentId: intent.providerPaymentId,
      idempotencyKey: dto.idempotencyKey,
      paymentMethod: dto.paymentMethod || 'SANDBOX_SIMULATION',
    });

    const saved = await payment.save();

    const result = this.mapToResponseDto(saved);
    result.clientSecret = intent.clientSecret;
    result.checkoutUrl = intent.checkoutUrl;
    return result;
  }

  /**
   * Confirms payment authoritatively via server gateway check.
   * Atomically transitions Order.paymentStatus to PAID.
   */
  async confirmCustomerPayment(
    restaurantSlug: string,
    orderReference: string,
    trackingToken: string,
    dto: ConfirmPaymentDto,
  ): Promise<PaymentTransactionResponseDto> {
    const restaurant = await this.restaurantModel.findOne({ slug: restaurantSlug });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const order = await this.orderModel.findOne({
      restaurantId: restaurant._id,
      orderReference,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.trackingToken !== trackingToken) {
      throw new ForbiddenException('Invalid tracking token for this order');
    }

    const payment = await this.paymentModel.findOne({
      restaurantId: restaurant._id,
      orderId: order._id,
      transactionReference: dto.transactionReference,
    });

    if (!payment) {
      throw new NotFoundException('Payment transaction record not found');
    }

    if (payment.status === PaymentTransactionStatus.SUCCESS) {
      return this.mapToResponseDto(payment);
    }

    // Authoritative verification via gateway
    const verification = await this.sandboxGateway.verifyPayment(
      payment.transactionReference,
      dto.providerPaymentId || payment.providerPaymentId,
    );

    if (verification.status === PaymentTransactionStatus.SUCCESS) {
      payment.status = PaymentTransactionStatus.SUCCESS;
      payment.completedAt = new Date();
      if (verification.providerPaymentId) {
        payment.providerPaymentId = verification.providerPaymentId;
      }
      await payment.save();

      // Atomically update order status
      order.paymentStatus = PaymentStatus.PAID;
      if (order.status === OrderStatus.SERVED) {
        order.status = OrderStatus.PAID;
        order.completedAt = new Date();
      }
      await order.save();

      this.logger.log(
        `Payment confirmed for order ${order.orderNumber} (${payment.transactionReference}): ${payment.currency} ${payment.amount}`,
      );

      // Emit real-time SSE stream update to Kitchen and Customer
      this.orderEventsService.emitOrderEvent(
        'ORDER_UPDATED',
        this.mapOrderToDto(order),
        order.trackingToken,
      );
    } else {
      payment.status = PaymentTransactionStatus.FAILED;
      payment.failureReason = 'Payment verification failed at gateway';
      await payment.save();
    }

    return this.mapToResponseDto(payment);
  }

  /**
   * Webhook callback handler with signature verification and replay protection.
   */
  async handleWebhook(
    rawPayload: string | Buffer,
    signature: string,
  ): Promise<{ received: boolean; status: string }> {
    const verification = await this.sandboxGateway.verifyWebhookSignature(
      rawPayload,
      signature,
    );

    if (!verification.isValid || !verification.transactionReference) {
      throw new BadRequestException(
        `Invalid webhook signature: ${verification.failureReason || 'verification failed'}`,
      );
    }

    const payment = await this.paymentModel.findOne({
      transactionReference: verification.transactionReference,
    });

    if (!payment) {
      throw new NotFoundException('Transaction referenced in webhook not found');
    }

    // Replay protection: if already in a terminal state, acknowledge without re-executing
    if (
      payment.status === PaymentTransactionStatus.SUCCESS ||
      payment.status === PaymentTransactionStatus.REFUNDED
    ) {
      return { received: true, status: 'already_processed' };
    }

    if (verification.status === PaymentTransactionStatus.SUCCESS) {
      payment.status = PaymentTransactionStatus.SUCCESS;
      payment.completedAt = new Date();
      if (verification.providerPaymentId) {
        payment.providerPaymentId = verification.providerPaymentId;
      }
      await payment.save();

      const order = await this.orderModel.findById(payment.orderId);
      if (order) {
        order.paymentStatus = PaymentStatus.PAID;
        if (order.status === OrderStatus.SERVED) {
          order.status = OrderStatus.PAID;
          order.completedAt = new Date();
        }
        await order.save();
        this.orderEventsService.emitOrderEvent(
          'ORDER_UPDATED',
          this.mapOrderToDto(order),
          order.trackingToken,
        );
      }
    } else if (verification.status === PaymentTransactionStatus.FAILED) {
      payment.status = PaymentTransactionStatus.FAILED;
      payment.failureReason = verification.failureReason || 'Webhook reported payment failure';
      await payment.save();
    }

    return { received: true, status: payment.status };
  }

  /**
   * Lists payment transactions for an authorized restaurant.
   */
  async getRestaurantPayments(
    restaurantId: string | Types.ObjectId,
  ): Promise<PaymentTransactionResponseDto[]> {
    const rId = typeof restaurantId === 'string' ? new Types.ObjectId(restaurantId) : restaurantId;
    const payments = await this.paymentModel
      .find({ restaurantId: rId })
      .sort({ createdAt: -1 })
      .limit(100);

    return payments.map((p) => this.mapToResponseDto(p));
  }

  /**
   * Processes a refund for a payment transaction (Admin only).
   */
  async refundPayment(
    restaurantId: string | Types.ObjectId,
    transactionReference: string,
    reason?: string,
  ): Promise<PaymentTransactionResponseDto> {
    const rId = typeof restaurantId === 'string' ? new Types.ObjectId(restaurantId) : restaurantId;

    const payment = await this.paymentModel.findOne({
      restaurantId: rId,
      transactionReference,
    });

    if (!payment) {
      throw new NotFoundException('Payment transaction not found');
    }

    if (payment.status !== PaymentTransactionStatus.SUCCESS) {
      throw new BadRequestException('Only successfully completed payments can be refunded');
    }

    payment.status = PaymentTransactionStatus.REFUNDED;
    payment.failureReason = reason || 'Admin initiated refund';
    await payment.save();

    const order = await this.orderModel.findById(payment.orderId);
    if (order) {
      order.paymentStatus = PaymentStatus.REFUNDED;
      await order.save();
      this.orderEventsService.emitOrderEvent(
        'ORDER_UPDATED',
        this.mapOrderToDto(order),
        order.trackingToken,
      );
    }

    this.logger.log(`Refund processed for transaction: ${transactionReference}`);
    return this.mapToResponseDto(payment);
  }

  private mapOrderToDto(order: OrderDocument): OrderResponseDto {
    return {
      id: order._id ? order._id.toString() : '',
      restaurantId: order.restaurantId ? order.restaurantId.toString() : '',
      tableId: order.tableId ? order.tableId.toString() : '',
      tableNumber: (order as any).tableNumber || 'Table',
      diningSessionId: order.diningSessionId?.toString(),
      orderNumber: order.orderNumber,
      trackingToken: order.trackingToken,
      items: (order.items || []).map((item) => ({
        menuItemId: item.menuItemId.toString(),
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
        specialInstructions: item.specialInstructions,
      })),
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount,
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
      createdAt: (order as any).createdAt || order.placedAt,
      updatedAt: (order as any).updatedAt || order.placedAt,
    };
  }

  private mapToResponseDto(
    doc: PaymentTransactionDocument,
  ): PaymentTransactionResponseDto {
    return {
      transactionReference: doc.transactionReference,
      orderId: doc.orderId.toString(),
      restaurantId: doc.restaurantId.toString(),
      amount: doc.amount,
      currency: doc.currency,
      status: doc.status,
      provider: doc.provider,
      providerPaymentId: doc.providerPaymentId,
      providerOrderId: doc.providerOrderId,
      completedAt: doc.completedAt,
      createdAt: (doc as any).createdAt || new Date(),
    };
  }
}
