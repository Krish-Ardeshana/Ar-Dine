# AR-DINE — Menu & Category Management Specification

> **Module:** Categories & Menu Items Subsystems  
> **Phase:** Implemented & Verified in Phase 4  
> **API Prefix:** `/api/v1/restaurants/:restaurantId/categories` & `/api/v1/restaurants/:restaurantId/menu-items`

---

## 1. Category Subsystem

### 1.1 Integrity & Tenancy Rules
- **Tenant Scoping:** Every category document contains a mandatory `restaurantId: Types.ObjectId`.
- **Unique Per-Tenant Names:** Compound unique index `{ restaurantId: 1, name: 1 }` guarantees that category names cannot collide within the same restaurant. Two distinct restaurants may safely share names (e.g. "Desserts").
- **Display Ordering:** Maintained via `displayOrder: number (min: 0)`. The `reorder` endpoint allows drag-and-drop batch updates.
- **Protection Against Orphaned Dishes:**
  - `DELETE /categories/:categoryId` checks if any dish references this category.
  - If dishes exist (`count > 0`), deletion is strictly rejected with `400 Bad Request`. Dishes must be reassigned or deleted first.

---

## 2. Dish & MenuItem Subsystem

### 2.1 Integrity & Tenancy Rules
- **Cross-Entity Tenant Validation:** When creating or updating a dish, `TenantValidationService.validateCategoryBelongsToRestaurant` ensures that the specified `categoryId` strictly belongs to the same restaurant tenant.
- **Slug Generation & Uniqueness:** Stable URL slugs are generated from dish names. Compound unique index `{ restaurantId: 1, slug: 1 }` ensures slug uniqueness within the restaurant.
- **Financial & Price Precision:**
  - Prices are stored as numbers (`min: 0`) with two-decimal-place validation.
  - Order items preserve immutable snapshots so future dish price changes never distort historical revenue.
- **Public Visibility vs Staff Visibility:**
  - Public customer menu queries filter `publicationStatus: PUBLISHED`.
  - Staff and admins can inspect `DRAFT` items to configure 3D models before publishing.
- **Availability State (`availabilityStatus`):**
  - `AVAILABLE`: Can be ordered.
  - `OUT_OF_STOCK`: Visible in menu but disabled for ordering.
  - Can be toggled rapidly by Kitchen Staff via `PATCH /menu-items/:id/availability`.
- **Historical Order Protection:**
  - Deleting a dish checks historical order references (`Order.items.menuItemId`).
  - If referenced in past orders, the dish is safely set to `publicationStatus: ARCHIVED` rather than deleted, preserving database referential integrity and financial audit history.

---

## 3. Endpoints Summary

### Categories:
- `POST /api/v1/restaurants/:restaurantId/categories` (Admin)
- `GET /api/v1/restaurants/:restaurantId/categories` (Public active / Admin all)
- `GET /api/v1/restaurants/:restaurantId/categories/:id` (Public / Admin)
- `PATCH /api/v1/restaurants/:restaurantId/categories/:id` (Admin)
- `PATCH /api/v1/restaurants/:restaurantId/categories/reorder` (Admin)
- `DELETE /api/v1/restaurants/:restaurantId/categories/:id` (Admin)

### Menu Items:
- `POST /api/v1/restaurants/:restaurantId/menu-items` (Admin)
- `GET /api/v1/restaurants/:restaurantId/menu-items` (Public published / Admin all, with category/dietary filters)
- `GET /api/v1/restaurants/:restaurantId/menu-items/:id` (Public / Admin)
- `PATCH /api/v1/restaurants/:restaurantId/menu-items/:id` (Admin)
- `PATCH /api/v1/restaurants/:restaurantId/menu-items/:id/availability` (Kitchen / Admin)
- `DELETE /api/v1/restaurants/:restaurantId/menu-items/:id` (Admin)
