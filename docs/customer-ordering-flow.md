# AR-DINE — Customer Digital Menu & Ordering Flow

## 1. Overview
The customer ordering journey starts at physical table QR scan and progresses to interactive 3D/AR menu exploration, cart accumulation, and authoritative server-side price revalidation.

## 2. Customer Journey Steps
1. **QR Resolution:**
   - Customer opens `/r/[restaurantSlug]/table/[tableToken]`.
   - The browser resolves table validity via `GET /api/v1/restaurants/public/:slug/tables/:tableToken`.
   - Returns restaurant metadata and confirms table is open and available.
2. **Session Attachment:**
   - The client invokes `POST /api/v1/restaurants/public/:slug/tables/:tableToken/sessions` to initialize or attach to the table's active dining session.
   - The session token is cached in `sessionStorage` under `ar_dine_session_${slug}_${token}`.
3. **Menu Exploration:**
   - Menu items and categories are loaded from public endpoints.
   - Real-time search filters dishes by keywords and dietary tags.
   - Category tabs enable quick navigation across appetizers, mains, and beverages.
4. **Interactive 3D / AR Preview:**
   - Dishes with 3D model metadata render a "3D Preview" badge.
   - Clicking opens Google's `<model-viewer>` component inside a modal, allowing turntable camera orbit, zoom, portion inspection, and native WebXR AR launch.
   - Photographic fallbacks gracefully display if 3D assets are unavailable or fail to load.
5. **Table Cart Persistence:**
   - Cart items are stored in `sessionStorage` scoped by `${restaurantSlug}_${tableToken}` to prevent cross-restaurant and cross-table contamination.
   - Users can add items, adjust quantities, remove items, and enter special cooking instructions.

## 3. Authoritative Order Validation (Phase 5 Boundary)
- **Client Totals are Untrusted:** The frontend only displays a provisional subtotal.
- **Server Price & Stock Verification:** Clicking "Validate & Review Order" dispatches the cart to `POST /api/v1/restaurants/public/:slug/tables/:tableToken/orders/validate`.
- The server re-reads authoritative database prices, checks live stock (`availabilityStatus === AVAILABLE`), verifies publication status, calculates the 5% tax amount, and computes the authoritative grand total.
- **Phase 6 Scope Notice:** Final order submission, payment gateway processing, and Kitchen Display System (KDS) ticketing are scheduled for Phase 6. Phase 5 enforces the server-authoritative cart boundary without simulating fake orders.
