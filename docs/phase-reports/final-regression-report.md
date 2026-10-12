# AR-DINE — Final Regression Test Report

> **Project:** AR-DINE — AR Smart Restaurant Management System (College Project-I, CEUP301)  
> **Date:** October 12, 2026  
> **Branch:** `main`  
> **Target Environment:** Node.js 24.20.0 / Windows & Linux Cross-Platform  
> **Persistence Layer:** MongoDB Atlas Multi-Tenant Replica Set  

---

## 1. Executive Summary

A comprehensive regression test suite was executed across all tiers of the AR-DINE platform, encompassing unit tests, end-to-end HTTP integration tests, live MongoDB Atlas cloud staging scenarios, static lint analysis, and production build compilations.

**Overall Result: 100% PASS (Zero Failures, Zero Regressions, Zero Lint Errors)**

---

## 2. Test Execution Matrix

| Test Suite | Framework | Target / Scope | Total Tests | Passed | Failed | Status |
|---|---|---|---|---|---|:---:|
| **Backend Unit Tests** | Vitest v4.1 | Services, Guards, Providers, Security Middleware | 192 | 192 | 0 | ✅ PASS |
| **Backend E2E Tests** | Vitest + Supertest | REST endpoints, Guards, Capability auth | 25 | 25 | 0 | ✅ PASS |
| **Atlas Staging Verification** | Node.js ESM Runner | Live cloud Atlas database (`ar_dine`) | 11 | 11 | 0 | ✅ PASS |
| **Backend Static Analysis** | Oxlint (Type-Aware) | 130 TypeScript files across `src/` and `test/` | 130 files | 130 files | 0 | ✅ PASS |
| **Frontend Static Analysis** | ESLint | Next.js 16 App Router UI components | All | All | 0 | ✅ PASS |
| **Backend Production Build** | NestJS CLI | Full production compilation to `dist/` | 1 | 1 | 0 | ✅ PASS |
| **Frontend Production Build** | Next.js Turbopack | 15 App Router routes with PPR | 15 routes | 15 routes | 0 | ✅ PASS |

---

## 3. Subsystem Breakdown & Validation Details

### 3.1 Authentication & Multi-Tenancy (27 Tests)
- Password hashing with `bcryptjs` (cost factor 12) verified.
- Generic invalid credentials response prevents account enumeration.
- Refresh token hashing (SHA-256) and single-use rotation verified.
- `RolesGuard` and `JwtAuthGuard` tenant isolation verified against cross-tenant access attempts.

### 3.2 Menu & Media Subsystem (33 Tests)
- Category management with foreign-key constraint protection (cannot delete categories containing active dishes).
- Menu items lifecycle: price updates, allergen flags, availability toggling, soft deletion preserving historical orders.
- Image magic byte validation: JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), WebP (`RIFF` + `WEBP`), and GLB (`glTF`).
- Path traversal immunity: directory normalization and traversal sequence blocking verified.
- Fail-safe media fallback: seamless graceful degradation to `LocalStorageProvider` when Cloudinary credentials are absent.

### 3.3 Physical Table QR & Dining Sessions (18 Tests)
- Table token generation (`tbl_<16-byte-hex>`) invariant against menu changes.
- Session lifecycle: activation, expiry enforcement, session reuse on active tables.
- Server-authoritative cart validation: client-side price tampering rejected.

### 3.4 Ordering & Kitchen Workflow (31 Tests)
- Server-authoritative subtotal, 5% tax, and grand total calculations.
- Database-level compound idempotency: `{ restaurantId: 1, idempotencyKey: 1 }`.
- Kitchen Display System FIFO ordering.
- Concurrency-safe state transitions: `PLACED` -> `CONFIRMED` -> `PREPARING` -> `READY` -> `SERVED`.
- Public guest order tracking with secure capability tokens (`trk_<16-byte-hex>`).

### 3.5 Real-Time Server-Sent Events (4 Tests)
- Event emission for `ORDER_PLACED` and `ORDER_UPDATED`.
- Token-authenticated guest subscription stream with RxJS filtering.
- Non-blocking SSE pipeline with rate-limit exemption.

### 3.6 Payment Processing Subsystem (15 Tests)
- Server-authoritative amount extraction from `order.grandTotal`.
- Idempotent payment intent initiation.
- Timing-safe HMAC-SHA256 signature verification in `SandboxPaymentGateway`.
- Order state and payment state decoupled (`order.paymentStatus` vs `order.status`).

### 3.7 Security & Rate Limiting (4 Tests)
- `SecurityHeadersMiddleware`: Sets `nosniff`, `DENY`, `HSTS`, `Referrer-Policy`, and CSP.
- `RateLimitMiddleware`: 180 requests/min sliding window per IP with automatic SSE stream bypass and memory cleanup.

---

## 4. Live MongoDB Atlas Verification (`verify-atlas-staging.mjs`)
- **Target Cluster:** `cluster0.ldspqcv.mongodb.net`
- **Database:** `ar_dine`
- **All 11 Cloud Scenarios Succeeded:**
  1. Collection indexing verified (all 10 collections present including `payment_transactions`).
  2. Multi-tenant restaurant entity resolved (`Spice Craft Kitchen`).
  3. Table QR token resolved (`Table 1`).
  4. Active dish & pricing loaded (`Paneer Tikka Angara` @ 340 INR).
  5. Dining session created and linked.
  6. Server-authoritative pricing & 5% tax calculated (680 + 34 = 714 INR).
  7. Idempotency key verified.
  8. KDS FIFO ordering verified in live Atlas collection.
  9. Full kitchen state machine transitions persisted in Atlas (`CONFIRMED` -> `PREPARING` -> `READY` -> `SERVED`).
  10. Authoritative capability token tracking view verified.
  11. Test data cleanly removed.

---

## 5. Conclusion
The AR-DINE system exhibits complete functional integrity, robust type-safety, verified cloud persistence, and strict security isolation across all audited capabilities.
