# AR-DINE — Payment System Integration Architecture

## 1. Executive Status: VERIFIED LOCALLY (Sandbox Gateway Operational)

| Dimension | Status | Evidence / Notes |
| :--- | :--- | :--- |
| **Payment Architecture & Logic** | **`VERIFIED LOCALLY`** | 15 unit tests passing across `payments.service.spec.ts` and `sandbox-payment-gateway.spec.ts`. Complete lifecycle and state machine implemented. |
| **Server-Authoritative Pricing** | **`VERIFIED LOCALLY`** | Payment amount is calculated strictly from `Order.grandTotal` (subtotal + 5% GST - discounts). Customer payload amounts are ignored. |
| **Idempotency Protection** | **`VERIFIED LOCALLY`** | Enforces unique `idempotencyKey` per restaurant tenant, preventing double-charging or duplicate transaction records. |
| **Webhook Signature Verification** | **`VERIFIED LOCALLY`** | HMAC-SHA256 timing-safe signature verification with replay protection against duplicate event delivery. |
| **Production Merchant Gateway** | **`UNVERIFIED — CREDENTIALS REQUIRED`** | Real external money collection is disabled. Sandbox gateway operates cleanly without charging live funds. |

---

## 2. Data Architecture & Separation of Concerns

AR-DINE maintains a strict separation between **Operational Order State** and **Financial Settlement State**:

```
+------------------------------------+       +-----------------------------------------+
|            Order Model             |       |       PaymentTransaction Model          |
+------------------------------------+       +-----------------------------------------+
| status: PLACED -> PREPARING ->     |       | transactionReference: "PAY-20261012-..." |
|         READY -> SERVED -> PAID    | 1   * | status: PENDING -> SUCCESS / FAILED     |
| paymentStatus: PENDING -> PAID     | <---> | provider: "sandbox" / "razorpay"        |
| grandTotal: 714.00 (authoritative) |       | idempotencyKey: "pay_btn_ORD-..."       |
+------------------------------------+       +-----------------------------------------+
```

### Key Principles:
1. **Never Trust the Client:**
   The frontend never passes the monetary amount during payment initiation. The backend loads the order from the database, retrieves `grandTotal`, and supplies it directly to the payment gateway.
2. **Immutable Snapshots:**
   Historical dish items and taxes cannot change during or after payment settlement.
3. **Double-Payment Prevention:**
   If `order.paymentStatus === 'PAID'`, subsequent payment initiation requests are rejected with `409 Conflict`.
4. **Idempotency Keying:**
   The client generates a unique `idempotencyKey` (e.g. `pay_btn_<orderRef>_<timestamp>`). Resending the request with the same key returns the existing transaction without creating duplicate intents.

---

## 3. Payment Gateway Abstraction (`IPaymentGateway`)

```typescript
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
```

The system ships with `SandboxPaymentGateway` (`backend/src/payments/providers/sandbox-payment-gateway.ts`), enabling offline and staging testing without external credit card processors or third-party fees.

---

## 4. API Endpoints

| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/restaurants/public/:slug/orders/:orderReference/payments/initiate?token=...` | Capability Token | Initiates payment intent and generates client credentials. |
| `POST` | `/api/v1/restaurants/public/:slug/orders/:orderReference/payments/confirm?token=...` | Capability Token | Authoritatively confirms payment, transitions `paymentStatus` to `PAID`, and triggers SSE event. |
| `POST` | `/api/v1/payments/webhook/:provider` | Public (Signed) | Webhook callback endpoint with HMAC signature verification and replay protection. |
| `GET` | `/api/v1/restaurants/:restaurantId/payments` | `RESTAURANT_ADMIN` | Lists historical payment transactions for staff auditing. |
| `POST` | `/api/v1/restaurants/:restaurantId/payments/:transactionReference/refund` | `RESTAURANT_ADMIN` | Processes an administrative refund and updates order status. |

---

## 5. Webhook Replay Protection

When receiving webhooks from payment gateways:
1. Compares `x-webhook-signature` using timing-safe buffer comparison (`crypto.timingSafeEqual`).
2. Checks whether the payment transaction is already in terminal state (`SUCCESS` or `REFUNDED`).
3. If already processed, immediately responds `{ received: true, status: 'already_processed' }` to prevent replay side effects.

---

## 6. How to Enable Production Payment Gateway

To configure an external payment provider (e.g., Razorpay or Stripe):

1. Obtain API Keys from your provider dashboard.
2. Configure `backend/.env`:
   ```env
   # Payment Gateway Sandbox / Production Settings
   PAYMENT_PROVIDER=sandbox
   PAYMENT_WEBHOOK_SECRET=your_production_webhook_signing_secret
   # Optional Provider Credentials:
   # RAZORPAY_KEY_ID=rzp_live_...
   # RAZORPAY_KEY_SECRET=...
   ```
3. Restart backend service.
