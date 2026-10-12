# AR-DINE — Security Audit & Threat Model

> **Scope:** Identity, Session Management, RBAC & Multi-Tenant Segregation  
> **Phase:** Phase 3 Verification  
> **Date:** October 12, 2026

---

## 1. Threat Modeling & Vulnerability Analysis

### 1.1 Account Enumeration Prevention
- **Threat:** Attackers probing `POST /api/v1/auth/login` to deduce whether target email addresses exist.
- **Defense Implemented:** `AuthService.login` returns an identical `401 Unauthorized` message (`"Invalid email or password"`) regardless of whether the email was not found or the password did not match.
- **Timing Parity:** When a user is not found, a dummy password hash comparison is executed to mitigate timing-based enumeration attacks.

### 1.2 Credential Theft via Database Leakage
- **Threat:** Malicious actor acquires a read-only database dump.
- **Defense Implemented:**
  - Passwords are salt-hashed using `bcryptjs` with cost `12`. Plaintext passwords are never logged or stored.
  - Refresh tokens are hashed using SHA-256 before storage in `refreshTokenHash`. Stolen database snapshots do not allow session hijacking.
  - Both `passwordHash` and `refreshTokenHash` are marked with `select: false` in the Mongoose schema, preventing standard queries from returning them.

### 1.3 Privilege Escalation & Role Forgery
- **Threat:** Users modifying registration payloads to grant themselves `SUPER_ADMIN` or `RESTAURANT_ADMIN`.
- **Defense Implemented:**
  - `RegisterDto` validates only `name`, `email`, and `password`.
  - NestJS `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` strictly discards or rejects unallowed properties.
  - Registration code forces `globalRoles: [UserRole.CUSTOMER]` and empty `memberships: []`.
  - Staff memberships can only be provisioned through authenticated administrative service boundaries.

### 1.4 Cross-Tenant Data Leakage
- **Threat:** A staff member assigned to Restaurant A attempts to inspect or mutate orders/menus belonging to Restaurant B.
- **Defense Implemented:**
  - `RolesGuard` extracts the target restaurant identifier and cross-checks against the user's verified `memberships` array.
  - Access is denied with `403 Forbidden` if the user's membership does not explicitly match the target `restaurantId`.
  - All MongoDB queries downstream utilize `TenantHelper.scopeQuery` ensuring tenant filters are unconditionally applied.

### 1.5 Token Invalidation & Session Revocation
- **Threat:** Compromised or logged-out access tokens continuing to be refreshed.
- **Defense Implemented:**
  - Short token lifetimes: Access tokens expire in 15 minutes.
  - On `POST /api/v1/auth/logout`, `refreshTokenHash` is removed from MongoDB.
  - Any subsequent attempt to use the refresh token is immediately rejected with `401 Unauthorized`.

---

## 2. Client-Side Token Storage & XSS Considerations

In the Next.js client, access tokens and refresh tokens are managed via `authStorage` (`localStorage`).
- **XSS Trade-off Analysis:** While HttpOnly cookies provide immunity against script-based token extraction, bearer tokens in single-page applications allow seamless cross-origin microservice decoupling and mobile/PWA compatibility.
- **Mitigation:**
  - Access token lifetimes are limited to 15 minutes.
  - All user inputs rendered on the frontend are sanitized by React's native JSX escaping.
  - CSP and CORS configurations restrict API communication strictly to configured origins (`CORS_ORIGIN`).
  - Production environments should consider transitioning refresh tokens to `HttpOnly, Secure, SameSite=Strict` cookies once a reverse-proxy (e.g., Nginx or Next.js API route proxy) is deployed in Phase 7.

---

## 3. Automated Security Test Evidence

The following security properties are verified by automated tests in `vitest`:

| Security Property | Test Location | Status |
| :--- | :--- | :---: |
| Password non-plaintext output | `password.service.spec.ts` | ✅ PASS |
| Incorrect password rejection | `password.service.spec.ts` | ✅ PASS |
| Customer-only registration enforcement | `auth.service.spec.ts` | ✅ PASS |
| Duplicate email race condition handling | `auth.service.spec.ts` | ✅ PASS |
| Generic invalid credential error | `auth.service.spec.ts` | ✅ PASS |
| Suspended account blocking | `auth.service.spec.ts` | ✅ PASS |
| Token refresh rotation & reuse denial | `auth.service.spec.ts` | ✅ PASS |
| Public route bypass validation | `jwt-auth.guard.spec.ts` | ✅ PASS |
| Missing token fail-closed enforcement | `jwt-auth.guard.spec.ts` | ✅ PASS |
| Global SUPER_ADMIN bypass verification | `roles.guard.spec.ts` | ✅ PASS |
| Scoped restaurant membership enforcement | `roles.guard.spec.ts` | ✅ PASS |
| Cross-tenant unauthorized access denial | `roles.guard.spec.ts` | ✅ PASS |
| Password hash exclusion from responses | `auth.controller.spec.ts` | ✅ PASS |
| Password hash exclusion from responses | `auth.controller.spec.ts` | ✅ PASS |
| Admin staff assignment boundary | `membership.service.spec.ts` | ✅ PASS |
| Single-use invitation token hashing & match | `restaurants.service.spec.ts` | ✅ PASS |
| Category dish existence deletion defense | `categories.service.spec.ts` | ✅ PASS |
| Cross-tenant category boundary check | `categories.service.spec.ts` | ✅ PASS |
| Cross-tenant menu item boundary check | `menu-items.service.spec.ts` | ✅ PASS |
| Historical order preservation on dish delete | `menu-items.service.spec.ts` | ✅ PASS |
| Image magic bytes verification (JPEG/PNG/WebP)| `media.service.spec.ts` | ✅ PASS |
| GLB binary header validation ('glTF') | `media.service.spec.ts` | ✅ PASS |
| Cross-tenant media deletion denial | `media.service.spec.ts` | ✅ PASS |

---

## 4. Phase 4 Threat Modeling & File Upload Hardening

### 4.1 Path Traversal in File Uploads
- **Threat:** Attackers upload filenames like `../../etc/passwd` to overwrite arbitrary filesystem files.
- **Defense Implemented:** `LocalStorageProvider` normalizes paths with `path.normalize`, strips relative tokens, and computes `path.resolve(this.baseStorageDir, key)`. If the target does not strictly start with `this.baseStorageDir`, the operation is aborted with `400 Bad Request`.

### 4.2 Malicious Polyglot & MIME Forgery
- **Threat:** Uploading PHP/HTML/JavaScript with a `.jpg` or `.glb` extension.
- **Defense Implemented:**
  - Mandatory binary magic number inspection in `MediaService`:
    - JPEG files must start with `FF D8 FF`.
    - PNG files must start with `89 50 4E 47`.
    - WebP files must start with `RIFF` and contain `WEBP`.
    - 3D models must start with ASCII `'glTF'`.
  - Rejection of non-GLB 3D files.

---

## 5. Phase 5 QR Code, Session Lifecycle & Cart Security

### 5.1 Physical Table QR Invariance & Tamper Resistance
- **Threat:** Menu mutations (dish renaming, price updates, category changes) cause printed table QRs to break or require expensive re-printing.
- **Defense Implemented:** Physical table QR codes encode an immutable table token (`tbl_<16-byte-hex>`) rather than mutable menu items or sequential database IDs. Modifying items has zero impact on QR URLs (`tables.service.spec.ts` & `qr.service.spec.ts`).

### 5.2 Client-Side Cart Price Tampering
- **Threat:** Adversaries manipulate client-side JavaScript or HTTP payloads to set dish prices to $0.01 or negative values.
- **Defense Implemented:** Server-side authoritative validation in `DiningSessionsService.validateCartOrder`. The server ignores client-supplied prices entirely and queries the authoritative database record for each dish (`dining-sessions.service.spec.ts`).

### 5.3 Cross-Tenant Dish Injection
- **Threat:** In a multi-tenant environment, an attacker seated at Restaurant A orders a dish from Restaurant B in their cart.
- **Defense Implemented:** `DiningSessionsService.validateCartOrder` cross-checks `TenantHelper.areObjectIdsEqual(menuItem.restaurantId, restaurant._id)` for every cart item. Foreign items are rejected with `400 Bad Request`.

### 5.4 Dining Session Hijacking & Expiry Enforcement
- **Threat:** Attacker uses an expired or foreign dining session token.
- **Defense Implemented:** Independent application-level expiration logic (`session.expiresAt <= new Date()`). Stale sessions are automatically transitioned to `EXPIRED` status, preventing unauthorized order submission.

---

## 6. Phase 6 Order Lifecycle, KDS & Concurrency Security

### 6.1 Server-Authoritative Price Snapshots & Immunity to Client Manipulation
- **Threat:** Malicious customers tampering with HTTP payloads to manipulate dish prices, tax rates, subtotals, or grand totals.
- **Defense Implemented:** `OrdersService.createOrder` accepts only dish IDs, quantities, and special instructions. Unit prices are retrieved exclusively from active database records. Subtotals, 5% tax, and grand totals are calculated authoritatively on the backend. Historical item details and prices are snapshotted immutably into `items` subdocuments. Subsequent dish price increases or deletions never affect historical orders.

### 6.2 Database-Enforced Idempotency & Duplicate Protection
- **Threat:** Double-clicking submit, network retry loops, or aggressive re-submissions creating duplicate orders in the kitchen.
- **Defense Implemented:** Database unique compound index `{ restaurantId: 1, idempotencyKey: 1 }` (sparse). Retrying with the same idempotency key and identical payload safely returns the existing order. Submitting the same key with conflicting items or quantities throws a `409 Conflict`.

### 6.3 Concurrency-Safe State Machine & Race Condition Immunity
- **Threat:** Simultaneous cancellation by a diner racing with kitchen staff accepting or cooking an order, leading to inconsistent terminal states.
- **Defense Implemented:** Centralized lifecycle state machine in `OrdersService.updateOrderStatus` and `cancelPublicOrder`. All mutations utilize atomic conditional updates `findOneAndUpdate({ _id, restaurantId, status: currentStatus }, ...)`. Conflicting concurrent requests fail with `409 Conflict`.

### 6.4 Secure Tracking Capabilities & Guest Privacy
- **Threat:** Attackers guessing sequential order numbers or using table QR tokens to eavesdrop on other customers' orders.
- **Defense Implemented:** Each order generates a high-entropy capability token (`trk_<16-byte-hex>`). Public order retrieval and cancellation strictly require matching tracking tokens. In addition, sensitive internal tracking tokens are stripped from staff KDS lists and public listings.

### 6.5 Strict Role-Based Access Control in Kitchen Workflow
- **Threat:** Waitstaff prematurely marking cooking states or kitchen staff marking orders served without table verification.
- **Defense Implemented:** State machine enforces actor role constraints:
  - `WAITER` cannot advance `PREPARING` or `READY` states (requires `KITCHEN_STAFF` or `RESTAURANT_ADMIN`).
  - `KITCHEN_STAFF` cannot advance `SERVED` state (requires `WAITER` or `RESTAURANT_ADMIN`).
  - Customer can cancel orders strictly while in `PLACED` state.

---

## 7. Phase 7 Comprehensive Security Audit & Hardening Findings

### 7.1 Quantitative Input Constraints & DoS Prevention
- **Vulnerability Identified:** Lack of explicit upper bounds on order item quantities allowed attackers to submit payloads with integer quantities like `99,999,999`, creating computational and storage strain.
- **Remediation Implemented:** Applied `@Max(50, { message: 'Quantity cannot exceed 50 per item' })` and `@MaxLength(200)` on `CreateOrderItemDto` and `ValidateOrderItemDto`. Enforced via centralized `ValidationPipe`.
- **Verification:** Verified by unit tests and E2E test `POST /api/v1/restaurants/public/:slug/tables/:token/orders should reject excessive quantity (>50) with 400 Bad Request`.

### 7.2 Strict Non-Whitelisted Property Rejection
- **Vulnerability Identified:** Attackers attempting parameter injection to override internal order fields (e.g. `paymentStatus`, `grandTotal`, `isArchived`).
- **Remediation Implemented:** Configured `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`. Unknown fields trigger an immediate `400 Bad Request`.
- **Verification:** Verified by E2E test `POST /api/v1/restaurants/public/:slug/tables/:token/orders should reject unwhitelisted fields (forbidNonWhitelisted) with 400`.

### 7.3 Real-Time SSE Capability Stream Hardening
- **Vulnerability Identified:** The customer SSE stream endpoint did not validate tracking tokens upfront, allowing unauthorized clients to open persistent HTTP connections.
- **Remediation Implemented:**
  1. `OrdersController.streamCustomerOrderEvents` requires a valid non-empty `token` query parameter, throwing `401 Unauthorized` upfront.
  2. `OrderEventsService.streamForOrder` strictly checks `event.trackingToken === cleanToken` in RxJS filter operators.
- **Verification:** Verified by unit tests in `order-events.service.spec.ts` and E2E test `GET /api/v1/restaurants/public/:slug/orders/:orderReference/events should reject subscription without token query param with 401`.

### 7.4 Query Result Pagination Bounds
- **Vulnerability Identified:** Unbounded `limit` query parameters on `GET /restaurants/:id/orders` allowed requesting arbitrary batch sizes.
- **Remediation Implemented:** Enforced an upper-bound cap: `const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 100);` in `OrdersService.getRestaurantOrders`.
- **Verification:** Verified in `orders.service.spec.ts`.

### 7.5 Path Traversal & Media Validation
- **Defense Implemented:** `LocalStorageProvider` normalizes paths and verifies `absoluteTarget.startsWith(baseStorageDir)`. `MediaService` inspects binary headers (magic numbers) for JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), WebP (`RIFF` + `WEBP`), and GLB (`glTF`). Non-conforming or oversized files are rejected before disk writing.
- **Verification:** Verified by 8 unit tests in `media.service.spec.ts`.

---

## 8. Phase 12 Payment Subsystem Threat Model & Controls

### 8.1 Timing-Safe Webhook & Signature Verification
- **Threat:** Attackers forge or tamper with payment provider webhooks or client-returned signatures to falsely mark orders as paid.
- **Defense Implemented:**
  - `SandboxPaymentGateway` computes HMAC-SHA256 over canonical payment payloads (`orderId:amount:currency`).
  - Buffers are compared using Node.js `crypto.timingSafeEqual` with upfront length parity checks to prevent timing disclosure attacks.
- **Verification:** Verified by unit tests in `sandbox-payment-gateway.spec.ts`.

### 8.2 Client-Side Settlement Tampering
- **Threat:** Malicious diner attempts to settle an order for less than the total bill.
- **Defense Implemented:**
  - `PaymentsService.initiatePayment` ignores client-submitted amounts. The backend authoritatively fetches the `Order` from MongoDB and retrieves `order.grandTotal`.
- **Verification:** Verified in `payments.service.spec.ts`.

### 8.3 Idempotent Transactions & Replay Defense
- **Threat:** Network reconnects or duplicate payment requests triggering multiple concurrent gateway intents.
- **Defense Implemented:**
  - Enforced unique compound index on `{ restaurantId: 1, idempotencyKey: 1 }` and tracking on `transactionReference`.
  - Replayed requests return the existing pending transaction safely without double billing.

### 8.4 State Machine Decoupling
- **Threat:** Malicious payment events prematurely modifying kitchen cooking states (`PREPARING`, `READY`).
- **Defense Implemented:**
  - `order.paymentStatus` (`UNPAID` -> `PROCESSING` -> `PAID`) operates independently of kitchen statuses (`PLACED` -> `CONFIRMED` -> `PREPARING` -> `READY` -> `SERVED`).
  - `order.status` only transitions to `PAID` if the food has already reached `SERVED`.

---

## 9. Phase 14 Security Headers & Rate Limiting Hardening

### 9.1 OWASP Security Headers Middleware
- **Defense Implemented:** Registered `SecurityHeadersMiddleware` across all API routes via NestJS `AppModule`:
  - `X-Content-Type-Options: nosniff` (MIME sniffing prevention)
  - `X-Frame-Options: DENY` (Clickjacking defense)
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(self), microphone=(), geolocation=()` (allows camera strictly for AR/QR scanning)
  - `Content-Security-Policy`: Restricts scripts, fonts, frames, and images to trusted sources while permitting AR model assets.
- **Verification:** Verified by unit tests in `middleware.spec.ts`.

### 9.2 Zero-Dependency In-Memory Rate Limiting
- **Defense Implemented:** Registered `RateLimitMiddleware` with an in-memory sliding window:
  - Caps IP requests to 180 requests/minute.
  - Automatically exempts continuous Server-Sent Events streams (`Accept: text/event-stream`) to prevent premature stream disruption.
  - Periodically purges stale IP memory records via an unref'd timer to guarantee zero memory leaks.
- **Verification:** Verified by unit tests in `middleware.spec.ts`.




