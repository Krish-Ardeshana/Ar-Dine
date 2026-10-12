# AR-DINE — Phase 6 Engineering Report
## Order Lifecycle State Machine, Kitchen Display System & Real-Time Synchronization

- **Project:** AR-DINE — AR Smart Restaurant Management System
- **Repository:** `D:\AR_Dine`
- **GitHub Remote:** `https://github.com/Krish-Ardeshana/Ar-Dine.git`
- **Branch:** `main`
- **Base Commit:** `baf98de` (Phase 5 Completion)
- **Phase:** 6
- **Date:** October 12, 2026

---

## 1. Executive Summary

Phase 6 delivers end-to-end production-minded order placement, centralized lifecycle state machine validation, a responsive restaurant-scoped Kitchen Display System (KDS), and secure real-time customer order tracking.

Key accomplishments:
1. **Server-Authoritative Order Placement (`POST /api/v1/restaurants/public/:slug/tables/:tableToken/orders`)**: Client-submitted unit prices, tax, and totals are ignored. Dishes are re-validated against active database records for tenant isolation, publication, and in-stock availability. Subtotals, 5% tax, and grand totals are calculated authoritatively on the backend.
2. **Database-Enforced Idempotency**: Protected against duplicate submissions (double clicks, browser retries, network timeouts) via a sparse unique compound index on `{ restaurantId: 1, idempotencyKey: 1 }`. Conflicting payloads with identical idempotency keys are rejected with `409 Conflict`.
3. **Immutable Historical Snapshots**: Item details, dish names at order time, unit prices, and quantities are snapshotted permanently into order subdocuments, guaranteeing that subsequent menu edits or price inflation never rewrite historical receipts.
4. **Order Lifecycle State Machine**: Centralized state transition service enforcing legal sequential steps: `PLACED` → `CONFIRMED` → `PREPARING` → `READY` → `SERVED`. All transitions use atomic conditional updates (`findOneAndUpdate({ _id, status: currentStatus }, ...)`) to prevent race conditions.
5. **Separation of Fulfillment Status from Payment Status**: Payment status remains decoupled (`PENDING`), with no fake payment gateways or simulated success states.
6. **Capability-Protected Guest Tracking**: High-entropy tracking tokens (`trk_<16-byte-hex>`) are generated server-side. Table tokens alone cannot access other diners' receipts or order history.
7. **Kitchen Display System (KDS)**: Operational back-of-house dashboard at `/dashboard/kitchen` featuring FIFO order queue sorting (`placedAt: 1`), status filtering, elapsed time urgency alerts (`>= 15 min`), and role-guarded state transitions.
8. **Real-Time Synchronization**: Native Server-Sent Events (SSE) via RxJS stream filtering for both kitchen and customer tracking, paired with an intelligent, visibility-aware polling fallback (5s interval, pauses when tab is hidden, immediate refresh upon refocus).

---

## 2. Implemented API Endpoints

| Method | Endpoint | Access / Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/restaurants/public/:slug/tables/:tableToken/orders` | Public (`@Public()`) | Idempotent guest order placement with server-authoritative pricing |
| `GET` | `/api/v1/restaurants/public/:slug/orders/:orderReference` | Public (Requires `?token=...`) | Customer order status & receipt breakdown |
| `POST` | `/api/v1/restaurants/public/:slug/orders/:orderReference/cancel` | Public (Requires `?token=...`) | Guest order cancellation (strictly while in `PLACED` state) |
| `GET` | `/api/v1/restaurants/public/:slug/orders/:orderReference/events` | Public (Requires `?token=...`) | SSE stream for customer tracking updates |
| `GET` | `/api/v1/restaurants/:restaurantId/orders/kitchen` | Staff JWT (RBAC) | Active FIFO kitchen display queue |
| `GET` | `/api/v1/restaurants/:restaurantId/orders` | Staff JWT (RBAC) | Restaurant order history with optional status filter |
| `GET` | `/api/v1/restaurants/:restaurantId/orders/:orderId` | Staff JWT (RBAC) | Single order details with tenant verification |
| `PATCH`| `/api/v1/restaurants/:restaurantId/orders/:orderId/status` | Staff JWT (RBAC) | State machine transition with role checks |
| `POST` | `/api/v1/restaurants/:restaurantId/orders/:orderId/cancel` | Staff JWT (RBAC) | Staff order cancellation with documented reason |
| `GET` | `/api/v1/restaurants/:restaurantId/orders/events` | Staff JWT (RBAC) | SSE stream for restaurant KDS updates |

---

## 3. Order Schema Changes & Database Indexes

### Schema Enhancements (`backend/src/database/schemas/order.schema.ts`):
- `trackingToken` (`String`, required, indexed): 32-character hex token (`trk_...`) for secure customer tracking capability.
- `idempotencyKey` (`String`, sparse): Idempotency identifier supplied by client.
- `cancelledBy` (`String`): Identifier of actor who cancelled the order (`'CUSTOMER'` or staff email).

### Compound & Unique Database Indexes:
- `{ restaurantId: 1, idempotencyKey: 1 }` (unique, sparse): Guarantees at-most-once order persistence per restaurant.
- `{ restaurantId: 1, status: 1, placedAt: 1 }`: Optimized for KDS FIFO queue queries.
- `{ restaurantId: 1, createdAt: -1 }`: Optimized for staff order history queries.
- `{ trackingToken: 1 }`: Optimized for customer tracking lookup.

---

## 4. Pricing & Tax Calculation Policy

- **Authoritative Source**: Prices are resolved exclusively from `MenuItem.price` in MongoDB.
- **Subtotal**: Sum of `(item.unitPrice * item.quantity)` for all validated dishes.
- **Tax Rate**: 5% standard GST/Tax rate.
- **Tax Amount**: Calculated as `subtotal * 0.05` and rounded to 2 decimal places using `Math.round(val * 100) / 100`.
- **Grand Total**: `subtotal + taxAmount - discountAmount`, persisted immutably in the order record.

---

## 5. Lifecycle Transition Matrix & RBAC

```
[PLACED] ──────> [CONFIRMED] ──────> [PREPARING] ──────> [READY] ──────> [SERVED]
    │                 │                   │
    └─────────────────┴───────────────────┴─────────> [CANCELLED]
```

- **`PLACED` → `CONFIRMED`**: `RESTAURANT_ADMIN`, `KITCHEN_STAFF`, `SUPER_ADMIN`
- **`CONFIRMED` → `PREPARING`**: `RESTAURANT_ADMIN`, `KITCHEN_STAFF`, `SUPER_ADMIN`
- **`PREPARING` → `READY`**: `RESTAURANT_ADMIN`, `KITCHEN_STAFF`, `SUPER_ADMIN`
- **`READY` → `SERVED`**: `RESTAURANT_ADMIN`, `WAITER`, `SUPER_ADMIN` (`KITCHEN_STAFF` prohibited)
- **Waiters**: Forbidden from advancing preparation states (`PREPARING` / `READY`).
- **Kitchen Staff**: Forbidden from marking orders `SERVED`.
- **Customer Cancellation**: Permitted strictly while status is `PLACED`. Once kitchen accepts or starts cooking, guest cancellation is rejected.

---

## 6. Frontend Implementation

1. **Kitchen Display System (`/dashboard/kitchen`)**:
   - Multi-tenant restaurant selector.
   - Status filters (`All Active`, `Incoming`, `Accepted`, `Cooking`, `Ready to Serve`).
   - Elapsed timer ticking in real-time with visual red alert when prep exceeds 15 minutes.
   - Dynamic transition action buttons preventing double-clicks.
   - Cancellation reason modal.
   - Live SSE connection status badge (`Real-Time SSE` / `Live Polling (5s)`).
2. **Customer Order Tracking Page (`/r/[restaurantSlug]/order/[orderReference]`)**:
   - Capability-protected with query token and session storage fallback.
   - Interactive visual stepper timeline indicating fulfillment stage.
   - Separate payment status indicator (`PENDING`).
   - Itemized receipt breakdown.
   - Real-time SSE updates and manual refresh fallback.
3. **Table Menu Checkout Wiring (`/r/[restaurantSlug]/table/[tableToken]`)**:
   - Replaced Phase 5 validation-only button with "Submit Order to Kitchen".
   - Generates client-side idempotency keys.
   - Clears table cart from `sessionStorage` upon confirmed success.
   - Seamlessly redirects to customer order tracking page.

---

## 7. Automated Test Results

### Backend Unit Tests (Vitest)
Command: `npm test`
- **Total Test Files Passed:** 17 / 17 (100%)
- **Total Tests Passed:** 121 / 121 (100%)
- **OrdersService Unit Tests:** 15 / 15 passed:
  - Authoritative pricing & 5% tax verification
  - Idempotent replay with matching payload
  - Conflicting payload idempotency rejection (409 Conflict)
  - Expired / invalid dining session rejection
  - Out of stock dish rejection
  - Cross-tenant foreign dish injection rejection
  - Sequential state transitions (`PLACED` → `CONFIRMED`)
  - Illegal jump rejection (`PLACED` → `SERVED`)
  - Terminal state transition rejection (`SERVED` → `CANCELLED`)
  - Role-based transition denials (Kitchen staff cannot mark `SERVED`, Waiter cannot mark `PREPARING`)
  - Valid tracking token retrieval
  - Invalid tracking token rejection (403 Forbidden)
  - Guest cancellation allowed while `PLACED`
  - Guest cancellation rejected once preparation starts

### Backend E2E Tests (Vitest + Supertest)
Command: `npm run test:e2e`
- **Total Tests Passed:** 14 / 14 passed:
  - Health diagnostics
  - Auth guards on `/api/v1/auth/me`, `/api/v1/auth/login`
  - Role and tenant guards on restaurant, category, menu, media, and table routes
  - Public order payload validation pipe on `/api/v1/restaurants/public/:slug/tables/:token/orders`
  - Unauthenticated access rejection on staff order routes `/orders`, `/orders/kitchen`, and `/orders/:id/status`

### Frontend Production Build & Linter (Next.js 16 + Turbopack + ESLint)
Commands: `npm run lint`, `npm run build`
- **ESLint Output:** 0 errors, 0 warnings
- **Production Build:** Next.js static and partial prerendering succeeded for all 15 routes, including `/dashboard/kitchen`, `/r/[restaurantSlug]/order/[orderReference]`, and `/r/[restaurantSlug]/table/[tableToken]`.

---

## 8. Database & Infrastructure Status

- **Database Test Status:** Unit tests execute against in-memory mocks. E2E tests validate NestJS guards, pipes, and routing against mocked controllers and schemas.
- **Live Atlas Connectivity Status:** **Unverified against live cluster** (as in Phase 0–5). The code connects via Mongoose connection URI when provided in `.env`.
- **Payment Gateway Status:** **Not implemented (By Design for Phase 6)**. Payments remain in `PENDING` status. No fake payment webhooks or simulated payment completions exist.

---

## 9. Git Commit Sequence & Repository State

Git Commits Created for Phase 6:
1. `feat(orders): implement secure order placement with authoritative pricing and idempotency`
2. `feat(orders): implement order lifecycle state machine, atomic transitions, and RBAC`
3. `feat(kitchen): implement restaurant-scoped Kitchen Display System (KDS)`
4. `feat(customer): add secure customer order tracking, receipt breakdown, and live sync`
5. `test(orders): add comprehensive unit and E2E tests for order lifecycle and KDS`
6. `docs(phase-6): complete order lifecycle specifications and engineering report`

- **Automatic Remote Push:** **None performed** (Strictly compliant with instruction 11).
- **Working Tree:** Clean, local branch `main`.
