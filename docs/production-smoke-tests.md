# AR-DINE — Production Smoke Test Procedures & Verification Matrix

## 1. Overview & Verification Strategy

Production smoke testing validates that critical customer-facing and kitchen-facing paths operate according to contract in a deployed or containerized environment without corrupting live tenant data.

Tests are categorized into:
- **Verified Locally in Production Mode:** Automated tests executing against compiled production artifacts, production configuration validators, and real HTTP servers.
- **Staging Verification Checklist:** Procedures to run immediately after deploying to a staging environment with live MongoDB Atlas and cloud infrastructure.

---

## 2. 12 Critical Smoke Test Scenarios

### Scenario 1 — Backend Health & Readiness Probe
- **Target Endpoint:** `GET /api/v1/health`
- **Expected Outcome:** HTTP `200 OK`
- **Verification Criteria:**
  - `status: "ok"`
  - `service: "ar-dine-backend"`
  - `database.status` accurately reflects actual state (`connected` in live environment, `unconfigured` when URI is blank)
  - No secret tokens, credentials, or internal file paths exposed in JSON payload.
- **Automated Verification:** Verified in `backend/test/production-smoke.e2e-spec.ts`.

### Scenario 2 — Database Connectivity & Degraded Mode Handling
- **Target Component:** `DatabaseService` & Mongoose Connection
- **Expected Outcome:** Graceful degradation without application crash when database is unreachable.
- **Verification Criteria:** Health endpoint responds with `ready: false` instead of hanging or terminating.
- **Automated Verification:** Verified in `backend/src/database/database.service.spec.ts`.

### Scenario 3 — Public Table QR Resolution
- **Target Endpoint:** `GET /api/v1/restaurants/public/:slug/tables/:tableToken`
- **Expected Outcome:** HTTP `200 OK` with restaurant metadata, table number, and active dining session status.
- **Negative Test:** Unknown table token or mismatched restaurant slug returns HTTP `400 Bad Request` or `404 Not Found`.

### Scenario 4 — Menu Retrieval & Published Dish Isolation
- **Target Endpoint:** `GET /api/v1/restaurants/public/:slug/menu`
- **Expected Outcome:** Returns categories and published menu items only.
- **Negative Test:** Unpublished or archived items are strictly omitted from public response.

### Scenario 5 — Dining Session Lifecycle
- **Target Endpoint:** `POST /api/v1/restaurants/public/:slug/tables/:tableToken/sessions`
- **Expected Outcome:** Returns valid opaque `sessionToken` (`ds_<16-byte-hex>`).
- **Authorization:** Guest must possess valid `sessionToken` for cart validation and order placement.

### Scenario 6 — Server-Authoritative Cart Validation
- **Target Endpoint:** `POST /api/v1/restaurants/public/:slug/tables/:tableToken/orders/validate`
- **Expected Outcome:** HTTP `200 OK` with server-calculated subtotal, 5% tax, and grand total. Client-submitted prices are completely ignored.

### Scenario 7 — Idempotent Order Placement
- **Target Endpoint:** `POST /api/v1/restaurants/public/:slug/tables/:tableToken/orders`
- **Expected Outcome:** HTTP `201 Created` with immutable `orderNumber` (`ORD-YYYYMMDD-XXXX`) and capability `trackingToken` (`trk_<16-byte-hex>`).
- **Idempotency Test:** Resubmitting with identical `idempotencyKey` returns existing order without creating a duplicate record or altering totals.

### Scenario 8 — Customer Capability Order Tracking
- **Target Endpoint:** `GET /api/v1/restaurants/public/:slug/orders/:orderReference?token=:trackingToken`
- **Expected Outcome:** HTTP `200 OK` with current status and item snapshots.
- **Negative Test:** Omitting `?token=` returns `401 Unauthorized`. Providing incorrect token returns `403 Forbidden`.

### Scenario 9 — Kitchen Display System (KDS) FIFO Queue
- **Target Endpoint:** `GET /api/v1/restaurants/:restaurantId/orders/kitchen`
- **Authorization:** Requires staff JWT with `KITCHEN_STAFF`, `WAITER`, or `RESTAURANT_ADMIN` role.
- **Expected Outcome:** Active orders returned in strict FIFO chronological order (`placedAt: 1`).

### Scenario 10 — Order Lifecycle State Transitions
- **Target Endpoint:** `PATCH /api/v1/restaurants/:restaurantId/orders/:orderId/status`
- **Expected Sequence:** `PLACED` → `CONFIRMED` → `PREPARING` → `READY` → `SERVED`.
- **Negative Test:** Illegal jumps (e.g. `PLACED` → `SERVED`) or staff role violations reject with `400 Bad Request`.

### Scenario 11 — Real-Time SSE Streams & Graceful Polling Fallback
- **Target Endpoint:** `GET /api/v1/restaurants/public/:slug/orders/:orderReference/events?token=:trackingToken`
- **Expected Outcome:** HTTP `200 OK` with `Content-Type: text/event-stream`.
- **Fallback Verification:** If proxy terminates connection, frontend switches to 5s visibility-aware polling (`syncStatus === 'POLLING'`).

### Scenario 12 — Media Asset Delivery & Path Security
- **Target Endpoint:** `/storage/restaurants/:id/images/:filename`
- **Expected Outcome:** Serves image with correct MIME header.
- **Security Test:** Requesting `../../etc/passwd` or traversals outside storage directory returns `400 Bad Request`.

---

## 3. Local Production Verification Results Matrix

| Scenario | Local Test Suite / Verification Mechanism | Pass / Fail | Notes |
| :--- | :--- | :--- | :--- |
| **Health Probe** | `test/production-smoke.e2e-spec.ts` | **PASS** | Status `ok`, no secret leakage. |
| **DB Degraded Mode** | `src/database/database.service.spec.ts` | **PASS** | 10 tests verifying all readiness states. |
| **Table Resolution** | `src/tables/qr.service.spec.ts` | **PASS** | Canonical HTTPS URL trimming verified. |
| **Menu Isolation** | `src/menu-items/menu-items.service.spec.ts` | **PASS** | Published state verified. |
| **Dining Session** | `src/dining-sessions/dining-sessions.service.spec.ts` | **PASS** | Session tokens verified. |
| **Cart Pricing** | `src/orders/orders.service.spec.ts` | **PASS** | Server pricing & 5% GST verified. |
| **Idempotency** | `src/orders/orders.service.spec.ts` | **PASS** | Deduplication logic verified. |
| **Order Tracking** | `test/app.e2e-spec.ts` | **PASS** | Capability token protection verified. |
| **KDS FIFO Queue** | `src/orders/orders.service.spec.ts` | **PASS** | FIFO sorting verified. |
| **State Machine** | `src/orders/orders.service.spec.ts` | **PASS** | Legal transitions & atomic updates verified. |
| **SSE & Polling** | `src/orders/order-events.service.spec.ts` | **PASS** | Capability token stream isolation verified. |
| **Media Security** | `src/media/media.service.spec.ts` | **PASS** | Magic numbers & path traversal blocks verified. |
