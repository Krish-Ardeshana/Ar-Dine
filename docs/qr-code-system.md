# AR-DINE — Stable Table QR Code Architecture

## 1. Overview
The AR-DINE QR code system generates immutable, physical-friendly QR codes for restaurant tables. It bridges physical table seating with digital 3D/AR menus and customer dining sessions.

## 2. Table Token & URL Structure
Each table receives a cryptographically secure, non-sequential token generated on creation:
- **Token Format:** `tbl_<16-byte-hex>` (e.g. `tbl_8f3a9e10c2d4b56789a0b1c2d3e4f5a6`)
- **Public URL Format:** `${FRONTEND_BASE_URL}/r/${restaurantSlug}/table/${tableToken}`
- **Example:** `http://localhost:3000/r/mumbai-spice/table/tbl_8f3a9e10c2d4b56789a0b1c2d3e4f5a6`

### Security Guarantees
1. **No Sequential Prediction:** Table tokens use `crypto.randomBytes(16)` (128 bits of entropy), making enumeration attacks impossible.
2. **No ObjectId Exposure:** MongoDB ObjectIds are never encoded as the bearer or lookup identifier in physical QR codes.
3. **No Credential Leakage:** QR codes contain only the public frontend routing URL. Database credentials, JWT secrets, and customer data are never placed in QR payloads.

## 3. Physical QR Stability Guarantee
A critical design requirement of AR-DINE is that **physical QR codes printed on acrylic table stands never become invalid** due to menu mutations:
- **Dish Renaming:** Does not alter restaurant slug or table token.
- **Price Updates:** Re-evaluated at request time; QR URL is unaffected.
- **Category Reordering / Deletion:** Has zero impact on the stable table route.
- **Dish Additions / Archivals:** Menu is loaded dynamically from `/api/v1/restaurants/:id/menu-items`.

QR codes only become inactive if the table itself is explicitly marked `OUT_OF_SERVICE` or archived by restaurant administrators.

## 4. Media & Printing Formats
- **Digital Preview (PNG Data URL):** Generated via `QRCode.toDataURL` at 400x400 resolution, error correction level `M` (15% redundancy).
- **Physical Printing (Scalable Vector SVG):** Generated via `QRCode.toString({ type: 'svg' })` for loss-free large-format printing on acrylic table stands and wooden blocks.
- **Table Label Print Mode:** Built-in dashboard modal offering clean, print-ready CSS cards formatted with restaurant name, table label, scannable QR, and customer instructions.

## 5. Rate Limits & Bulk Limits
- **Batch Generation Endpoint:** `GET /api/v1/restaurants/:restaurantId/tables/qr/batch?limit=50` strictly limits bulk generation to 50 tables per request to prevent server denial-of-service.
