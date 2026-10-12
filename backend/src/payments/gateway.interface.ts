import { PaymentTransactionStatus } from '../database/schemas/payment-transaction.schema.js';

export interface CreatePaymentIntentDto {
  transactionReference: string;
  orderId: string;
  restaurantId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
}

export interface PaymentIntentResult {
  providerOrderId: string;
  providerPaymentId?: string;
  status: PaymentTransactionStatus;
  clientSecret?: string;
  checkoutUrl?: string;
}

export interface VerifyWebhookResult {
  isValid: boolean;
  transactionReference?: string;
  providerPaymentId?: string;
  status?: PaymentTransactionStatus;
  failureReason?: string;
}

export interface IPaymentGateway {
  readonly providerName: string;
  createPaymentIntent(dto: CreatePaymentIntentDto): Promise<PaymentIntentResult>;
  verifyPayment(
    transactionReference: string,
    providerPaymentId?: string,
  ): Promise<{ status: PaymentTransactionStatus; providerPaymentId?: string }>;
  verifyWebhookSignature(
    rawPayload: string | Buffer,
    signature: string,
  ): Promise<VerifyWebhookResult>;
}
