# AR-DINE — Comprehensive Testing Strategy

## 1. Overview & Testing Pyramid

The AR-DINE quality assurance architecture follows a strict, multi-tiered testing strategy ensuring data integrity, multi-tenant isolation, cryptographic capability protection, and resilient client-server synchronization.

```
                  ┌────────────────────────┐
                  │    Production Build    │  Next.js 16 (Turbopack) & NestJS (dist)
                  ├────────────────────────┤
                  │     E2E / API Tests    │  Supertest + NestJS ValidationPipe & RBAC
                  ├────────────────────────┤
                  │   Mongoose Schema QA   │  Schema validation, constraints, indexes
                  ├────────────────────────┤
                  │   Service Unit Tests   │  Fast in-memory mock suites (Vitest)
                  └────────────────────────┘
```

---

## 2. Test Suites & Coverage Breakdown

### 2.1 Backend Unit Test Suites (18 suites, 130 tests)
Run via: `npm test` inside `backend/`

1. **Authentication & RBAC (`auth.service.spec.ts`, `jwt-auth.guard.spec.ts`, `password.service.spec.ts`, `roles.guard.spec.ts`)**:
   - Argon2/Bcrypt password hashing with salt verification.
   - Access & refresh token generation and payload structure.
   - Global role checks (`SUPER_ADMIN`).
   - Tenant-scoped role checks (`RESTAURANT_ADMIN`, `KITCHEN_STAFF`, `WAITER`).
2. **Tenant Isolation (`tenant.helper.spec.ts`, `tenant-validation.service.spec.ts`)**:
   - Canonical ObjectId normalization.
   - Strictly scoped query filters `{ restaurantId: Types.ObjectId }`.
   - Cross-tenant resource mismatch assertion.
3. **Menu & Media Pipeline (`menu-items.service.spec.ts`, `categories.service.spec.ts`, `media.service.spec.ts`)**:
   - Dish and category CRUD scoped to tenant.
   - Magic binary signature inspection (JPEG, PNG, WebP, GLB).
   - Maximum upload size caps (5 MB images, 25 MB 3D GLB meshes).
   - Path traversal prevention.
4. **Physical Table QR & Dining Sessions (`qr.service.spec.ts`, `tables.service.spec.ts`, `dining-sessions.service.spec.ts`)**:
   - Cryptographic table tokens (`tbl_<16-byte-hex>`).
   - Opaque dining session tokens (`ds_<16-byte-hex>`).
   - Independent application-level session expiration.
5. **Orders & Kitchen Display System (`orders.service.spec.ts`, `order-events.service.spec.ts`)**:
   - Server-authoritative price calculation (ignoring client prices).
   - 5% GST calculation with deterministic rounding.
   - Database-enforced idempotency (`idempotencyKey` replay vs 409 conflict).
   - Centralized lifecycle state machine (`PLACED` → `CONFIRMED` → `PREPARING` → `READY` → `SERVED`).
   - Role-based transition constraints (waiters cannot prep, kitchen staff cannot serve).
   - High-entropy tracking tokens (`trk_<16-byte-hex>`).
   - Customer cancellation rules (permitted only in `PLACED` state).
   - Atomic conditional optimistic updates preventing race conditions.
   - Real-time SSE stream tenant and capability filtering.
   - Query upper-bound limits (max 100).
6. **Mongoose Schema Constraints (`schemas.spec.ts`)**:
   - Required fields, enums, subdocument arrays, and min-quantity constraints.
7. **Health Diagnostics (`health.controller.spec.ts`)**:
   - Service uptime, timestamp, and database readyState diagnostics.

---

### 2.2 Backend End-to-End API Tests (1 suite, 20 tests)
Run via: `npm run test:e2e` inside `backend/`

- Global `ValidationPipe` whitelist and non-whitelisted property rejection (`forbidNonWhitelisted: true`).
- Negative, zero, fractional, and excessive quantities (>50) rejection.
- Unauthorized access rejection (401) on:
  - `/api/v1/auth/me`
  - `/api/v1/restaurants`
  - `/api/v1/restaurants/:id/categories`
  - `/api/v1/restaurants/:id/menu-items`
  - `/api/v1/restaurants/:id/media/upload-image`
  - `/api/v1/restaurants/:id/tables`
  - `/api/v1/restaurants/:id/orders`
  - `/api/v1/restaurants/:id/orders/kitchen`
  - `/api/v1/restaurants/:id/orders/:orderId/status`
  - `/api/v1/restaurants/:id/orders/:orderId/cancel`
  - `/api/v1/restaurants/:id/dining-sessions`
  - `/api/v1/restaurants/:id/dining-sessions/:sessionId/close`
- Public SSE event subscription rejection without tracking token (401).

---

### 2.3 Frontend Quality & Type Gates
Run via: `npm run lint` and `npm run build` inside `frontend/`

- **Static Analysis**: ESLint 9 + `eslint-config-next` with 0 errors and 0 warnings.
- **Route Compilation**: Next.js 16.4.0 Turbopack compiles all 15 routes cleanly into static and partial prerendered targets.
- **Purity & Hydration**: Strict React 19 compiler purity rules enforced. No impure functions (e.g. `Date.now()`) called during render.

---

## 3. Database & Environmental Status

| Component | Status | Verification Detail |
| :--- | :--- | :--- |
| **Unit Test Database** | `VERIFIED` | In-memory mocks and Mongoose model compilation |
| **E2E Test Pipeline** | `VERIFIED` | Supertest running against complete NestJS HTTP kernel |
| **Live MongoDB Atlas** | `UNVERIFIED` | No live cluster credentials configured in environment |
| **Payment Gateway** | `NOT IMPLEMENTED` | Kept strictly in `PENDING` payment state by design |
| **Physical WebXR Devices** | `UNVERIFIED` | Requires physical Android/iOS hardware with ARCore/ARKit |

---

## 4. Execution Commands

```powershell
# 1. Run all backend unit tests
cd backend
npm test

# 2. Run backend E2E integration tests
npm run test:e2e

# 3. Run backend lint & production build
npm run lint
npm run build

# 4. Run frontend lint & production build
cd ../frontend
npm run lint
npm run build
```
