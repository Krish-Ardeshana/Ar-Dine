import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import { PaymentTransactionStatus } from '../../database/schemas/payment-transaction.schema.js';
import {
  CreatePaymentIntentDto,
  IPaymentGateway,
  PaymentIntentResult,
  VerifyWebhookResult,
} from '../gateway.interface.js';

@Injectable()
export class SandboxPaymentGateway implements IPaymentGateway {
  private readonly logger = new Logger(SandboxPaymentGateway.name);
  readonly providerName = 'sandbox';
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookSecret =
      this.configService.get<string>('PAYMENT_WEBHOOK_SECRET') ||
      'sandbox-webhook-signing-secret-default';
  }

  async createPaymentIntent(
    dto: CreatePaymentIntentDto,
  ): Promise<PaymentIntentResult> {
    const providerOrderId = `sbx_ord_${dto.transactionReference}`;
    const providerPaymentId = `sbx_pay_${crypto.randomBytes(8).toString('hex')}`;

    this.logger.log(
      `Created sandbox payment intent for order ${dto.orderId}: ${dto.currency} ${dto.amount}`,
    );

    return {
      providerOrderId,
      providerPaymentId,
      status: PaymentTransactionStatus.PENDING,
      clientSecret: `sbx_sec_${crypto.randomBytes(12).toString('hex')}`,
      checkoutUrl: `https://sandbox.ar-dine.internal/checkout/${providerOrderId}`,
    };
  }

  async verifyPayment(
    transactionReference: string,
    providerPaymentId?: string,
  ): Promise<{ status: PaymentTransactionStatus; providerPaymentId?: string }> {
    this.logger.log(
      `Authoritatively verifying sandbox payment for transaction: ${transactionReference}`,
    );

    return {
      status: PaymentTransactionStatus.SUCCESS,
      providerPaymentId: providerPaymentId || `sbx_pay_verified_${crypto.randomBytes(6).toString('hex')}`,
    };
  }

  async verifyWebhookSignature(
    rawPayload: string | Buffer,
    signature: string,
  ): Promise<VerifyWebhookResult> {
    if (!signature) {
      return { isValid: false, failureReason: 'Missing webhook signature header' };
    }

    try {
      const payloadString =
        typeof rawPayload === 'string'
          ? rawPayload
          : Buffer.from(rawPayload).toString('utf8');

      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payloadString)
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'utf8');
      const expectedBuf = Buffer.from(expectedSignature, 'utf8');

      if (sigBuf.length !== expectedBuf.length) {
        return { isValid: false, failureReason: 'Signature mismatch' };
      }

      const isSignatureValid = crypto.timingSafeEqual(sigBuf, expectedBuf);

      if (!isSignatureValid) {
        return { isValid: false, failureReason: 'Signature mismatch' };
      }

      const parsed = JSON.parse(payloadString) as {
        transactionReference?: string;
        providerPaymentId?: string;
        event?: string;
      };

      const status =
        parsed.event === 'payment.succeeded'
          ? PaymentTransactionStatus.SUCCESS
          : parsed.event === 'payment.failed'
            ? PaymentTransactionStatus.FAILED
            : PaymentTransactionStatus.PROCESSING;

      return {
        isValid: true,
        transactionReference: parsed.transactionReference,
        providerPaymentId: parsed.providerPaymentId,
        status,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid payload';
      return { isValid: false, failureReason: msg };
    }
  }
}
