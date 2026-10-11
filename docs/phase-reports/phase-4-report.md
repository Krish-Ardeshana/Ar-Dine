# AR-DINE — Phase 4 Deliverable Report
## Restaurant Onboarding, Menu Management & 3D/AR Asset Pipeline

- **Date:** October 12, 2026
- **Status:** COMPLETED & VERIFIED
- **Base Commit:** `f8bd79f` (Phase 3 completion)

---

## 1. Actual Restaurant Onboarding Flow & Authorization

Phase 4 implements a secure, non-public restaurant onboarding and provisioning flow:
- **Restricted Provisioning:** Only authenticated `SUPER_ADMIN` accounts can provision a new restaurant tenant via `POST /api/v1/restaurants`.
- **Owner Role Assignment:** If an `ownerEmail` matches an existing registered user, the system assigns the user a `RESTAURANT_ADMIN` membership scoped specifically to the new restaurant.
- **Cryptographic Invitations:** If the invited owner does not yet exist, a single-use `RestaurantInvitation` is issued containing a 64-character cryptographic token (`crypto.randomBytes(32).toString('hex')`). Only the SHA-256 hash (`tokenHash`) is persisted in MongoDB.
- **Recipient Verification on Acceptance:** Upon accepting (`POST /api/v1/restaurants/invitations/accept`), the system verifies that the authenticated user's session email matches the invitation's recipient email, preventing stolen token abuse.
- **Single-Use Revocation:** Tokens expire after 7 days and are immediately transitioned to `ACCEPTED` upon use.

---

## 2. Endpoints Implemented

### Restaurants (`/api/v1/restaurants`):
- `POST /`: `SUPER_ADMIN` only. Provisions restaurant and assigns owner.
- `GET /me`: Authenticated. Lists restaurants where caller has staff/admin memberships.
- `GET /:restaurantId`: Public / Staff. Returns public published info or full profile.
- `PATCH /:restaurantId`: `RESTAURANT_ADMIN` or `SUPER_ADMIN`. Updates restaurant settings.
- `POST /:restaurantId/invitations`: `RESTAURANT_ADMIN` or `SUPER_ADMIN`. Issues staff invitation token.
- `POST /invitations/accept`: Authenticated user accepts invitation token.

### Categories (`/api/v1/restaurants/:restaurantId/categories`):
- `POST /`: `RESTAURANT_ADMIN`. Creates category with per-restaurant name uniqueness.
- `GET /`: Public (active) / Staff (all). Returns categories ordered by `displayOrder`.
- `GET /:categoryId`: Public / Staff. Returns category details.
- `PATCH /:categoryId`: `RESTAURANT_ADMIN`. Updates category details.
- `PATCH /reorder`: `RESTAURANT_ADMIN`. Batch reorders categories.
- `DELETE /:categoryId`: `RESTAURANT_ADMIN`. Deletes category (strictly rejected if dishes exist).

### Menu Items (`/api/v1/restaurants/:restaurantId/menu-items`):
- `POST /`: `RESTAURANT_ADMIN`. Creates dish with cross-entity category tenant validation.
- `GET /`: Public (published) / Staff (all). Filters by category, search, dietary tags, pagination.
- `GET /:menuItemId`: Public / Staff. Returns dish details.
- `PATCH /:menuItemId`: `RESTAURANT_ADMIN`. Updates dish details.
- `PATCH /:menuItemId/availability`: `RESTAURANT_ADMIN` or `KITCHEN_STAFF`. Toggles stock availability.
- `DELETE /:menuItemId`: `RESTAURANT_ADMIN`. Safely archives dish if historical orders exist, or deletes permanently.

### Media & 3D Assets (`/api/v1/restaurants/:restaurantId/media`):
- `POST /upload-image`: `RESTAURANT_ADMIN`. Validates JPEG/PNG/WebP <= 5MB with magic bytes.
- `POST /upload-model`: `RESTAURANT_ADMIN`. Validates self-contained binary GLB <= 25MB with `glTF` magic bytes.
- `DELETE /`: `RESTAURANT_ADMIN`. Deletes asset scoped strictly to `restaurants/${restaurantId}/`.

---

## 3. Category and Dish CRUD Status

- **Category CRUD:** Fully operational with per-tenant unique compound indexes and protection against deleting categories containing active dishes.
- **Dish CRUD:** Fully operational with server-side price validation (`min: 0`), automated slug generation, dietary tagging, image/3D metadata association, and historical order snapshot preservation.

---

## 4. Storage Provider & Actual Upload Verification Status

- **Storage Abstraction:** Decoupled via `IStorageProvider` interface.
- **`LocalStorageProvider`:** Fully implemented and verified. Defends against path traversal attacks.
- **`CloudinaryStorageProvider`:** Implemented with environment validation (`CLOUDINARY_*`).
- **Cloud Verification Status:** Marked as **NOT CONFIGURED / UNVERIFIED** because live Cloudinary credentials were not provided in the environment. Local storage provider handles uploads deterministically in dev and testing.

---

## 5. Supported Image and 3D Formats & Restrictions

- **Images:**
  - Formats: JPEG, PNG, WebP.
  - Limit: 5 MB.
  - Verification: Magic byte inspection (`FF D8 FF`, `89 50 4E 47`, `RIFF...WEBP`).
- **3D Models:**
  - Format: Strictly self-contained binary GLB (`.glb`).
  - Limit: 25 MB.
  - Verification: Header signature check (ASCII `'glTF'` / `0x46546C67`). Rejects loose `.gltf` with unverified external texture links or executable scripts.

---

## 6. 3D Viewer and AR Launch Verification

- **Google `<model-viewer>` Integration:** Fully integrated in `frontend/src/components/ModelViewer.tsx` using client-side dynamic mounting.
- **Turntable & Camera:** Supports 360° orbit, touch zoom, turntable reset, shadow rendering, and lighting exposure.
- **AR Launch vs 3D Inspection:** Explicitly decoupled. AR capability is checked via `canActivateAR`. The "View in AR" button is rendered only on compatible mobile devices (Android Chrome WebXR / iOS Quick Look).
- **Fallback Hierarchy:** If no 3D model is attached or model loading fails, photographic dish fallback is displayed seamlessly.

---

## 7. Test, Lint, and Build Results

### Backend Verification:
- **Unit Tests (`vitest run`):** **84 passed tests** across 13 test files (0 failures).
- **E2E Tests (`vitest run --config ./vitest.config.e2e.ts`):** **8 passed tests** covering health, auth, and Phase 4 route authorization guards (0 failures).
- **Linter (`oxlint`):** **0 warnings, 0 errors** across 78 files.
- **Production Build (`nest build`):** Clean compilation to `dist/`.

### Frontend Verification:
- **Linter (`eslint`):** **0 warnings, 0 errors**.
- **Production Build (`next build`):** Clean Turbopack compilation; 9 static routes prerendered (`/`, `/_not-found`, `/dashboard`, `/dashboard/categories`, `/dashboard/menu`, `/dashboard/menu/new`, `/invitations/accept`, `/login`, `/register`).

---

## 8. Live MongoDB Connectivity Status

- In-memory and mocked unit tests verify schema constraints, tenant scoping, and authorization guards.
- Offline degradation mode (`database.status: unconfigured`) verified on health probe when `MONGODB_URI` is omitted.
- Live Atlas cluster connection remains unverified pending production credentials.

---

## 9. Tenant Isolation & Security Test Results

- Cross-tenant category access rejected: ✅ Verified (`categories.service.spec.ts`).
- Cross-tenant dish access rejected: ✅ Verified (`menu-items.service.spec.ts`).
- Cross-tenant media deletion denied: ✅ Verified (`media.service.spec.ts`).
- Deleting category with active dishes rejected: ✅ Verified (`categories.service.spec.ts`).
- Historical order audit preserved on dish deletion: ✅ Verified (`menu-items.service.spec.ts`).
- Image & GLB magic byte forgery rejected: ✅ Verified (`media.service.spec.ts`).
- Single-use invitation token hash validation: ✅ Verified (`restaurants.service.spec.ts`).

---

## 10. Deliverables & Git Status

- **Working Tree:** Clean.
- **Remote Push:** Not executed per instructions.
