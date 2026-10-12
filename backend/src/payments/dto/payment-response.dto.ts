import { PaymentTransactionStatus } from '../../database/schemas/payment-transaction.schema.js';

export class PaymentTransactionResponseDto {
  transactionReference: string;
  orderId: string;
  restaurantId: string;
  amount: number;
  currency: string;
  status: PaymentTransactionStatus;
  provider: string;
  providerPaymentId?: string;
  providerOrderId?: string;
  clientSecret?: string;
  checkoutUrl?: string;
  completedAt?: Date;
  createdAt: Date;
}
