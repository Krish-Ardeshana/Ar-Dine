# AR-DINE — Complete API Reference (`/api/v1`)

> **Specification:** REST API Architecture  
> **Status:** Phase 1 through Phase 5 Endpoints Verified

---

## 1. System & Diagnostics
- `GET /api/v1/health`: System uptime, service name, and MongoDB connection status.

## 2. Identity & Authentication (`/api/v1/auth`)
- `POST /register`: Public customer registration (`CUSTOMER` role only).
- `POST /login`: Enumeration-resistant authentication returning JWT access token, rotated refresh token, and user profile.
- `POST /refresh`: Rotates access and refresh tokens via SHA-256 database lookup.
- `POST /logout`: Invalidates server-side refresh session.
- `GET /me`: Returns authenticated profile and authorized restaurant memberships.

## 3. Restaurant Onboarding & Management (`/api/v1/restaurants`)
- `POST /`: `SUPER_ADMIN` only. Provisions a new restaurant and assigns an owner.
- `GET /me`: Lists all restaurants where current user holds staff memberships.
- `GET /:restaurantId`: Returns public profile (if published) or full details (if staff).
- `PATCH /:restaurantId`: `RESTAURANT_ADMIN` only. Updates restaurant settings.
- `POST /:restaurantId/invitations`: `RESTAURANT_ADMIN` only. Issues 64-character hex single-use invitation token.
- `POST /invitations/accept`: Authenticated user accepts token, receiving staff membership.

## 4. Category Management (`/api/v1/restaurants/:restaurantId/categories`)
- `POST /`: `RESTAURANT_ADMIN`. Creates category with duplicate-name check.
- `GET /`: Public (active) / Staff (all). Returns categories ordered by `displayOrder`.
- `GET /:categoryId`: Public / Staff. Returns single category.
- `PATCH /:categoryId`: `RESTAURANT_ADMIN`. Updates name, description, display order, or status.
- `PATCH /reorder`: `RESTAURANT_ADMIN`. Batch reorders categories.
- `DELETE /:categoryId`: `RESTAURANT_ADMIN`. Deletes category (fails if dishes exist).

## 5. Menu Item & Dish Management (`/api/v1/restaurants/:restaurantId/menu-items`)
- `POST /`: `RESTAURANT_ADMIN`. Creates dish with category validation and slug generation.
- `GET /`: Public (published only) / Staff (all). Filters by category, availability, and dietary.
- `GET /:menuItemId`: Public / Staff. Returns dish details.
- `PATCH /:menuItemId`: `RESTAURANT_ADMIN`. Updates dish fields.
- `PATCH /:menuItemId/availability`: `RESTAURANT_ADMIN` or `KITCHEN_STAFF`. Toggles stock availability.
- `DELETE /:menuItemId`: `RESTAURANT_ADMIN`. Archives dish if historical orders exist, deletes permanently if zero orders.

## 6. Media & 3D Assets (`/api/v1/restaurants/:restaurantId/media`)
- `POST /upload-image`: `RESTAURANT_ADMIN`. Validates JPEG/PNG/WebP <= 5MB with magic bytes.
- `POST /upload-model`: `RESTAURANT_ADMIN`. Validates self-contained binary GLB <= 25MB with `glTF` magic header.
- `DELETE /`: `RESTAURANT_ADMIN`. Deletes asset belonging to `restaurants/${restaurantId}/`.

## 7. Table & QR Management (`/api/v1/restaurants/:restaurantId/tables`)
- `POST /`: `RESTAURANT_ADMIN`. Creates physical table with immutable `tableToken`.
- `GET /`: Staff/Admin. Lists tables for active restaurant.
- `GET /:tableId`: Staff/Admin. Returns single table.
- `PATCH /:tableId`: `RESTAURANT_ADMIN`. Updates table number, capacity, and operational status.
- `DELETE /:tableId`: `RESTAURANT_ADMIN`. Archives table safely to preserve historical order links.
- `GET /:tableId/qr`: Staff/Admin. Generates stable target URL, base64 PNG data URL, and printable SVG.
- `GET /qr/batch`: Staff/Admin. Batch generates QR codes (up to 50 tables per request).

## 8. Public QR Resolution & Dining Sessions
- `GET /api/v1/restaurants/public/:slug/tables/:tableToken`: Public. Resolves restaurant and table from physical QR code, checking publication and table active status.
- `POST /api/v1/restaurants/public/:slug/tables/:tableToken/sessions`: Public. Starts or joins the table's current `ACTIVE` dining session (default 2-hour duration).
- `GET /api/v1/dining-sessions/:sessionToken/validate`: Public. Validates session token and checks application-level expiry.
- `POST /api/v1/restaurants/public/:slug/tables/:tableToken/orders/validate`: Public. Revalidates customer cart against server prices and live inventory, computing authoritative subtotal and taxes.
- `GET /api/v1/restaurants/:restaurantId/dining-sessions`: Staff/Admin. Lists active sessions for restaurant.
- `POST /api/v1/restaurants/:restaurantId/dining-sessions/:sessionId/close`: Staff/Admin. Closes dining session and resets table status to `AVAILABLE`.
