# AR-DINE — Phase 5 Engineering Report
**Phase:** 5 — Stable Table QR Generation, Dining Sessions & Customer Ordering Experience  
**Date:** October 12, 2026  
**Repository:** `D:\AR_Dine`  
**Base Commit:** `233a464` (Phase 4 completion)  
**Git Branch:** `main`  
**Working Tree:** Clean (all commits verified locally, remote push withheld per rules)

---

## 1. QR URL Format & Verification Results
- **Public QR Route:** `${FRONTEND_BASE_URL}/r/${restaurantSlug}/table/${tableToken}`
- **Table Token Format:** Cryptographically random, non-sequential hex string: `tbl_<16-byte-hex>` (32 hex characters with 128 bits of entropy) generated via `crypto.randomBytes(16)`.
- **Physical Invariance Guarantee:**
  - The QR URL is strictly decoupled from mutable menu items, dish names, categories, or prices.
  - Renaming dishes, updating prices, or modifying menu categories does **not** invalidate printed QR stands.
  - Verified by unit tests in `src/tables/qr.service.spec.ts` and `src/tables/tables.service.spec.ts`.
- **Output Formats:**
  - High-resolution base64 PNG data URL (`width: 400, margin: 2, errorCorrectionLevel: 'M'`) for digital preview & download.
  - Clean Scalable Vector Graphics (SVG) markup for professional print reproduction on acrylic table stands.

---

## 2. Table Management & QR Download Functionality
- **Owner Dashboard Route:** `/dashboard/tables`
- **Capabilities:**
  - Full table CRUD: Create table (table number, capacity, initial operational status), edit capacity/status, and soft-archive.
  - Duplicate table numbers within the same restaurant are rejected (`409 ConflictException`).
  - Table token remains strictly immutable upon creation.
  - High-resolution QR code preview modal with one-click URL copy.
  - Direct PNG download (`<restaurantSlug>-<tableNumber>-qr.png`).
  - Print-friendly table label view formatted with restaurant branding, table number, scannable QR, and customer instructions, directly invoking browser `window.print()`.

---

## 3. Dining Session Security & Lifecycle
- **Session Identifier:** Opaque, cryptographically random `ses_<24-byte-hex>` token (192 bits of entropy). Never exposes MongoDB ObjectIds or database credentials.
- **Lazy Table Attachment:**
  - When a customer scans a table QR, `POST /api/v1/restaurants/public/:slug/tables/:tableToken/sessions` retrieves the current `ACTIVE` session for that physical table.
  - If no active session exists or the previous session has expired, a new session is initialized with a default 2-hour duration (`expiresAt`).
- **Multi-Customer Physical Table Sharing:**
  - Multiple guests seated at the same physical table share the same active table session.
  - Table operational status transitions from `AVAILABLE` to `OCCUPIED`.
- **Application-Level Expiry:**
  - Independent of MongoDB background TTL timing, application logic in `DiningSessionsService.validateSession` enforces strict date checks (`expiresAt <= now`), transitioning expired sessions to `EXPIRED` status.
- **Session Closure:**
  - Staff / Admin can close sessions via `POST /api/v1/restaurants/:id/dining-sessions/:sessionId/close`, setting status to `COMPLETED` and resetting the table back to `AVAILABLE`.

---

## 4. Customer Menu Pages & Real API Integrations
- **Customer Route:** `/r/[restaurantSlug]/table/[tableToken]`
- **Next.js App Router Architecture:** Wrapped in React `<Suspense>` boundary to support Next.js 16 Partial Prerendering and streaming.
- **Real-Time Integration:**
  - Resolves table validity via `GET /api/v1/restaurants/public/:slug/tables/:tableToken`.
  - Connects to active dining session via `POST /api/v1/restaurants/public/:slug/tables/:tableToken/sessions`.
  - Fetches live categories and published menu items from `/api/v1/restaurants/:id/menu-items`.
- **Interactive 3D / AR Preview:**
  - Embedded Google `<model-viewer>` component with turntable auto-orbit, camera zoom, orientation reset, and WebXR AR launch.
  - Photographic image fallbacks automatically display if 3D assets are unavailable or fail to load.
- **Category Navigation & Instant Search:** Fast client-side filtering by categories, search keywords, and dietary labels (Veg, Vegan, Gluten-Free, Prep Time).

---

## 5. Cart Functionality & Persistence Strategy
- **Scoped Client Persistence:** Table cart items are cached in `sessionStorage` under `ar_dine_cart_${restaurantSlug}_${tableToken}`. This strictly isolates carts and prevents cross-restaurant or cross-table data contamination if a customer visits multiple establishments.
- **Cart Features:** Add dish, remove dish, increment/decrement stepper, and per-item special cooking instructions.
- **Untrusted Client Totals:** Client-side totals are displayed strictly as provisional subtotals. Final payable amounts and tax calculations are exclusively evaluated on the server.

---

## 6. Ordering Boundary: Phase 5 vs Phase 6
- **Server-Authoritative Cart Revalidation:**
  - Customers click "Validate & Review Order" to send their cart to `POST /api/v1/restaurants/public/:slug/tables/:tableToken/orders/validate`.
  - The server verifies session validity, checks that items belong to the restaurant, confirms dish publication and active stock availability (`availabilityStatus === AVAILABLE`), re-evaluates authoritative database prices, and calculates the 5% tax amount.
- **Authoritative Boundary Notice:**
  - Final order persistence, Kitchen Display System (KDS) ticketing, and payment gateway capture are explicitly reserved for **Phase 6**.
  - Phase 5 does not simulate fake orders or persist stubbed order records, strictly adhering to architectural guidelines.

---

## 7. Verification, Tests, Lint & Build Results

### Backend
- **Linting:** `oxlint --type-aware src/ test/` -> **0 errors, 0 warnings**.
- **Unit Tests:** `vitest run` -> **16 test files passed, 106 tests passed (100% pass rate, 2.24s)**.
  - `src/tables/qr.service.spec.ts` (7 tests)
  - `src/tables/tables.service.spec.ts` (7 tests)
  - `src/dining-sessions/dining-sessions.service.spec.ts` (8 tests)
  - `src/media/media.service.spec.ts` (8 tests)
  - `src/restaurants/restaurants.service.spec.ts` (7 tests)
  - `src/categories/categories.service.spec.ts` (6 tests)
  - `src/menu-items/menu-items.service.spec.ts` (7 tests)
  - `src/database/schemas/schemas.spec.ts` (13 tests)
  - `src/database/multi-tenant/tenant-validation.service.spec.ts` (8 tests)
  - `src/database/multi-tenant/tenant.helper.spec.ts` (7 tests)
  - `src/auth/auth.service.spec.ts` (7 tests)
  - `src/auth/membership.service.spec.ts` (5 tests)
  - `src/auth/password.service.spec.ts` (5 tests)
  - `src/auth/guards/roles.guard.spec.ts` (6 tests)
  - `src/auth/guards/jwt-auth.guard.spec.ts` (3 tests)
  - `src/health/health.controller.spec.ts` (2 tests)
- **E2E Tests:** `vitest run --config ./vitest.config.e2e.ts` -> **1 test file passed, 10 tests passed (4.29s)**.
- **Production Build:** `nest build` -> **Exit code 0 (Compiled successfully)**.

### Frontend
- **Linting:** `eslint` -> **0 errors, 0 warnings**.
- **Type Checking & Production Build:** `next build` -> **Finished TypeScript check in 1410ms with 0 errors**.
  - All 13 static and dynamic routes compiled successfully under Turbopack:
    - `/`
    - `/_not-found`
    - `/dashboard`
    - `/dashboard/categories`
    - `/dashboard/menu`
    - `/dashboard/menu/new`
    - `/dashboard/tables`
    - `/invitations/accept`
    - `/login`
    - `/r/[restaurantSlug]/table/[tableToken]` (Partial Prerendering enabled)
    - `/register`

---

## 8. Live MongoDB Connectivity Status
- **Status:** **UNVERIFIED AGAINST LIVE ATLAS CLUSTER**.
- **Reason:** No live Atlas cluster credentials are configured in `.env`.
- **Integrity Guarantee:** In accordance with prompt rules, all schema validations, unique constraints, and compound tenant indexes were verified using in-memory Mongoose models and test harnesses. Live connectivity is explicitly marked unverified.

---

## 9. Security & Cross-Tenant Test Results
1. **Cross-Tenant Table Access:** Staff from Restaurant A attempting to query or update tables belonging to Restaurant B is rejected with `404 Not Found` / `403 Forbidden` (`TenantValidationService`).
2. **Foreign Dish Injection:** Injecting a dish belonging to a competing restaurant into Table 5's cart is caught and rejected with `400 Bad Request` (`DiningSessionsService.validateCartOrder`).
3. **Price Manipulation:** Altering unit prices on the client is completely ignored; the server recalculates totals from authoritative database records.
4. **Out-of-Service / Archived Tables:** Scanning an archived or out-of-service table returns `404 Not Found` / `400 Bad Request` instead of granting ordering privileges.

---

## 10. Git Commits & Working-Tree Status
All Phase 5 changes have been committed cleanly to `main`:
- `b78489a`: `feat(qr): implement stable table QR generation`
- `2e56302`: `feat(sessions): implement secure dining session lifecycle`
- `2322244`: `feat(customer): build QR-based digital menu and table management`
- `983d740`: `test(customer): verify QR and tenant isolation`
- **Remote Push:** Withheld in accordance with development rules (never push automatically).

---

## 11. Known Limitations & Blocked Dependencies
1. **Physical AR Hardware:** WebXR camera pass-through was tested against browser component standards; physical mobile device validation with ARCore/ARKit requires deployment to an HTTPS host.
2. **Payment Gateway & KDS Dispatch:** Final payment processing and live kitchen ticket printing are scheduled for Phase 6.
3. **Live Atlas Cluster:** Connectivity remains unverified until valid Atlas credentials are provided in `.env`.
