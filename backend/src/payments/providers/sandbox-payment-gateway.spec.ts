import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { PaymentTransactionStatus } from '../../database/schemas/payment-transaction.schema.js';
import { SandboxPaymentGateway } from './sandbox-payment-gateway.js';

describe('SandboxPaymentGateway', () => {
  let gateway: SandboxPaymentGateway;
  const mockSecret = 'test-signing-secret-123';

  beforeEach(() => {
    const mockConfigService = {
      get: (key: string) => (key === 'PAYMENT_WEBHOOK_SECRET' ? mockSecret : undefined),
    } as unknown as ConfigService;

    gateway = new SandboxPaymentGateway(mockConfigService);
  });

  it('should initialize with sandbox provider name', () => {
    expect(gateway.providerName).toBe('sandbox');
  });

  it('should create payment intent with sandbox order and client secret', async () => {
    const intent = await gateway.createPaymentIntent({
      transactionReference: 'PAY-100',
      orderId: 'ord_1',
      restaurantId: 'rest_1',
      amount: 450,
      currency: 'INR',
      idempotencyKey: 'idemp_100',
    });

    expect(intent.providerOrderId).toBe('sbx_ord_PAY-100');
    expect(intent.providerPaymentId).toContain('sbx_pay_');
    expect(intent.status).toBe(PaymentTransactionStatus.PENDING);
    expect(intent.clientSecret).toBeDefined();
    expect(intent.checkoutUrl).toContain('/checkout/sbx_ord_PAY-100');
  });

  it('should verify payment successfully', async () => {
    const verification = await gateway.verifyPayment('PAY-100');
    expect(verification.status).toBe(PaymentTransactionStatus.SUCCESS);
    expect(verification.providerPaymentId).toBeDefined();
  });

  describe('verifyWebhookSignature', () => {
    it('should reject webhook when signature is missing', async () => {
      const result = await gateway.verifyWebhookSignature('{}', '');
      expect(result.isValid).toBe(false);
      expect(result.failureReason).toContain('Missing webhook signature');
    });

    it('should reject webhook when signature is invalid', async () => {
      const result = await gateway.verifyWebhookSignature('{"event":"test"}', 'invalid_signature');
      expect(result.isValid).toBe(false);
      expect(result.failureReason).toBe('Signature mismatch');
    });

    it('should validate and parse webhook with valid HMAC signature', async () => {
      const payload = JSON.stringify({
        event: 'payment.succeeded',
        transactionReference: 'PAY-100',
        providerPaymentId: 'sbx_pay_abc',
      });

      const signature = crypto
        .createHmac('sha256', mockSecret)
        .update(payload)
        .digest('hex');

      const result = await gateway.verifyWebhookSignature(payload, signature);
      expect(result.isValid).toBe(true);
      expect(result.transactionReference).toBe('PAY-100');
      expect(result.providerPaymentId).toBe('sbx_pay_abc');
      expect(result.status).toBe(PaymentTransactionStatus.SUCCESS);
    });
  });
});
