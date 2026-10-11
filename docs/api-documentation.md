# AR-DINE — Complete API Reference (`/api/v1`)

> **Specification:** REST API Architecture  
> **Status:** Phase 1 through Phase 4 Endpoints Verified

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
