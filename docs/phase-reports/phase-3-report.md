# AR-DINE — Phase 3 Deliverable Report
## Authentication, JWT Security & Role-Based Access Control

- **Date:** October 12, 2026
- **Status:** COMPLETED & VERIFIED
- **Base Commit:** `09727fd` (Phase 2 completion)

---

## 1. Authentication Architecture Actually Implemented

AR-DINE Phase 3 implements an enterprise-grade, defense-in-depth authentication and authorization architecture:

- **Modular Identity System:** Dedicated `AuthModule` integrating `@nestjs/passport` and `@nestjs/jwt`.
- **Password Security Engine (`PasswordService`):** Salted and hashed with `bcryptjs` (work factor / cost: 12). Completely eliminates plaintext storage and passes 5 automated verification tests.
- **Dual-Token Session Lifecycle:**
  - Short-lived Access Token (15-minute default) bearing minimal verified claims (`sub`, `email`, `globalRoles`).
  - Cryptographic Refresh Token with **SHA-256 one-way hashing** on MongoDB persistence (`refreshTokenHash`).
  - Honest session revocation: `POST /api/v1/auth/logout` unsets `refreshTokenHash`, preventing token refresh abuse.
- **Fail-Closed Global Guard:** Registered `JwtAuthGuard` globally via `APP_GUARD`. Any route without `@Public()` decorator is strictly denied access if unauthenticated.
- **Multi-Tenant Role Guard (`RolesGuard`):** Evaluates `@Roles(...)` (for global platform roles) and `@RequireRestaurantRole(...)` (for tenant-scoped staff roles). Scopes permissions to target restaurant (`x-restaurant-id` header or `:restaurantId` route parameter).
- **Mongoose User Schema Security:** `passwordHash` and `refreshTokenHash` are marked with `select: false`. API responses and queries never expose sensitive security material.

---

## 2. Implemented APIs and Guards

All endpoints are registered under `/api/v1/auth`:

| Endpoint | Method | Guard / Protection | Description | Status Code |
| :--- | :---: | :---: | :--- | :---: |
| `/register` | `POST` | `@Public()` | Public customer registration with password complexity enforcement | `201 Created` |
| `/login` | `POST` | `@Public()` | Enumeration-resistant authentication returning token pair & profile | `200 OK` |
| `/refresh` | `POST` | `@Public()` | Rotates access token and refresh token via hashed database validation | `200 OK` |
| `/logout` | `POST` | `JwtAuthGuard` | Revokes server-side refresh session | `200 OK` |
| `/me` | `GET` | `JwtAuthGuard` | Returns authenticated user profile and authorized memberships | `200 OK` |

### Implemented Guards and Decorators:
- `JwtAuthGuard`: Enforces token validity, signature, expiration, and active account status (`accountStatus === 'ACTIVE'`).
- `RolesGuard`: Enforces global `SUPER_ADMIN` / `CUSTOMER` and tenant-scoped `RESTAURANT_ADMIN`, `KITCHEN_STAFF`, `WAITER`.
- `@Public()`: Marks route accessible without JWT authentication.
- `@Roles(...)`: Declares required global roles.
- `@RequireRestaurantRole(...)`: Declares required restaurant-scoped roles.
- `@CurrentUser()`: Param decorator extracting verified user context.

---

## 3. Role & Membership Permission Matrix

- **`SUPER_ADMIN`**: Global platform owner. Unrestricted cross-tenant access. Granted strictly through trusted administrative provisioning.
- **`CUSTOMER`**: Default role for all public registrations. Allowed to browse menus and place table orders. Cannot access restaurant administration or kitchen endpoints.
- **`RESTAURANT_ADMIN`**: Scoped to the specific restaurant where membership is held. Manages menus, 3D models, tables, and staff. Accessing another restaurant returns `403 Forbidden`.
- **`KITCHEN_STAFF`**: Scoped to their restaurant's Kitchen Display System (KDS).
- **`WAITER`**: Scoped to their restaurant's floor orders and table service.

---

## 4. Environment Variables Added

In `backend/.env.example` and `src/config/env.validation.ts`:
- `JWT_ACCESS_SECRET`: Secret key for access token signing (min 32 chars in production).
- `JWT_ACCESS_EXPIRES_IN`: Access token lifetime (default: `15m`).
- `JWT_REFRESH_SECRET`: Secret key for refresh token signing (min 32 chars in production).
- `JWT_REFRESH_EXPIRES_IN`: Refresh token lifetime (default: `7d`).
- `JWT_ISSUER`: Token issuer claim (default: `ar-dine-api`).
- `JWT_AUDIENCE`: Token audience claim (default: `ar-dine-app`).
- `CORS_ORIGIN`: Allowed origins (e.g. `http://localhost:3000`).

---

## 5. Frontend Pages & Session Strategy

- **Session Strategy:** Bearer tokens managed via `authStorage` client helper (`localStorage`) and React 19 `AuthContext`.
- **Pages Created:**
  - `/login`: Accessible login form with email/password validation, credential error handling, and redirect to home.
  - `/register`: Accessible customer registration form with real-time password complexity checklist.
- **Components & Navigation:**
  - `Navbar`: Responsive navigation bar displaying active user name, role badges, and an interactive logout action.
  - Landing page (`/`): Displays active authenticated user context and Phase 3 completed security status.

---

## 6. Actual Test and Build Results

### Backend Unit Tests (`vitest run`):
- `password.service.spec.ts`: 5 passed tests
- `auth.service.spec.ts`: 7 passed tests
- `roles.guard.spec.ts`: 6 passed tests
- `jwt-auth.guard.spec.ts`: 3 passed tests
- `membership.service.spec.ts`: 5 passed tests
- `schemas.spec.ts`: 13 passed tests
- `tenant.helper.spec.ts`: 7 passed tests
- `tenant-validation.service.spec.ts`: 8 passed tests
- `health.controller.spec.ts`: 2 passed tests
- **Total Backend Unit Tests:** **56 passed tests** (0 failed).

### Backend E2E Tests (`vitest run --config ./vitest.config.e2e.ts`):
- `test/app.e2e-spec.ts`: 4 passed tests (Health check, Registration customer enforcement, PasswordHash non-disclosure, Login credential check).
- **Total Backend E2E Tests:** **4 passed tests** (0 failed).

### Code Quality & Compilation:
- `backend lint` (`oxlint`): **0 warnings, 0 errors** across 48 files.
- `backend build` (`nest build`): Compiled successfully to `dist/`.
- `frontend lint` (`eslint`): **0 warnings, 0 errors**.
- `frontend build` (`next build`): Compiled successfully with Turbopack, static prerendering for `/`, `/login`, `/register`.

---

## 7. Live MongoDB Verification Status

- Mocked and isolated in-memory unit tests verify schema constraints, tenant scoping, and authorization guards.
- The backend application continues to support graceful offline degradation (`database.status: unconfigured`) when `MONGODB_URI` is omitted.
- MongoDB Atlas live cluster connection remains unverified against a production Atlas cluster pending credential configuration.

---

## 8. Security Limitations & Future Scope

1. **Staff Invitations / Onboarding:** Customer registration is strictly limited to `CUSTOMER`. Restaurant owner onboarding and staff invitation flows will be implemented in Phase 4 (Restaurant Management).
2. **HttpOnly Cookie Reverse-Proxy:** Bearer tokens are stored in `authStorage` for client portability. Future deployment hardening (Phase 7) may introduce an API proxy for HttpOnly cookies.

---

## 9. Deliverables & Documentation Created

- `backend/src/auth/*`: Complete auth module, services, controllers, guards, strategies, DTOs, tests.
- `frontend/src/*`: Auth context, storage, types, login page, register page, updated navbar.
- `docs/authentication.md`: Comprehensive API specification and token flow.
- `docs/authorization-matrix.md`: Granular permission matrix across roles and tenants.
- `docs/security-audit.md`: Threat model, anti-enumeration, and security guarantees.
- `docs/development-setup.md`: Updated environment setup guide.
- `docs/phase-reports/phase-3-report.md`: Phase 3 audit and completion report.
- `README.md`: Updated project implementation status.
