import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequireRestaurantRole } from '../auth/decorators/restaurant-roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UserRole } from '../database/schemas/user.schema.js';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto.js';
import { InitiatePaymentDto } from './dto/initiate-payment.dto.js';
import { PaymentTransactionResponseDto } from './dto/payment-response.dto.js';
import { PaymentsService } from './payments.service.js';

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Public Customer Endpoint: Initiate payment intent for an order.
   * Access: Opaque tracking capability token.
   */
  @Post('restaurants/public/:slug/orders/:orderReference/payments/initiate')
  @HttpCode(HttpStatus.CREATED)
  async initiateCustomerPayment(
    @Param('slug') slug: string,
    @Param('orderReference') orderReference: string,
    @Query('token') token: string,
    @Body() dto: InitiatePaymentDto,
  ): Promise<PaymentTransactionResponseDto> {
    return this.paymentsService.initiateCustomerPayment(
      slug,
      orderReference,
      token,
      dto,
    );
  }

  /**
   * Public Customer Endpoint: Confirm payment execution authoritatively.
   * Access: Opaque tracking capability token.
   */
  @Post('restaurants/public/:slug/orders/:orderReference/payments/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmCustomerPayment(
    @Param('slug') slug: string,
    @Param('orderReference') orderReference: string,
    @Query('token') token: string,
    @Body() dto: ConfirmPaymentDto,
  ): Promise<PaymentTransactionResponseDto> {
    return this.paymentsService.confirmCustomerPayment(
      slug,
      orderReference,
      token,
      dto,
    );
  }

  /**
   * Payment Gateway Webhook Endpoint.
   * Replay-protected and signature verified.
   */
  @Post('payments/webhook/:provider')
  @HttpCode(HttpStatus.OK)
  async handlePaymentWebhook(
    @Param('provider') _provider: string,
    @Headers('x-webhook-signature') signature: string,
    @Body() body: any,
  ): Promise<{ received: boolean; status: string }> {
    const rawPayload = typeof body === 'string' ? body : JSON.stringify(body);
    return this.paymentsService.handleWebhook(rawPayload, signature);
  }

  /**
   * Staff Endpoint: List payments for a restaurant.
   * Access: RESTAURANT_ADMIN or SUPER_ADMIN.
   */
  @Get('restaurants/:restaurantId/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRestaurantRole(UserRole.RESTAURANT_ADMIN)
  async getRestaurantPayments(
    @Param('restaurantId') restaurantId: string,
  ): Promise<PaymentTransactionResponseDto[]> {
    return this.paymentsService.getRestaurantPayments(restaurantId);
  }

  /**
   * Staff Endpoint: Process payment refund.
   * Access: RESTAURANT_ADMIN or SUPER_ADMIN.
   */
  @Post('restaurants/:restaurantId/payments/:transactionReference/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRestaurantRole(UserRole.RESTAURANT_ADMIN)
  async refundPayment(
    @Param('restaurantId') restaurantId: string,
    @Param('transactionReference') transactionReference: string,
    @Body('reason') reason?: string,
  ): Promise<PaymentTransactionResponseDto> {
    return this.paymentsService.refundPayment(
      restaurantId,
      transactionReference,
      reason,
    );
  }
}
