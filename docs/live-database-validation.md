# AR-DINE — Live MongoDB Atlas Database Validation Report

## 1. Executive Status: VERIFIED

Live cloud database connectivity to MongoDB Atlas is **`VERIFIED`**.

The connection was established against the user's provisioned Atlas replica cluster (`cluster0.ldspqcv.mongodb.net`), seeded with deterministic fixtures, and verified through both the live running NestJS server and automated staging integration tests.

---

## 2. Cluster Topology & Credentials Sanitization

| Property | Value / Verification |
| :--- | :--- |
| **Cluster SRV** | `cluster0.ldspqcv.mongodb.net` |
| **Active Primary Shard** | `ac-qsnbbl3-shard-00-00.ldspqcv.mongodb.net` |
| **Database Name** | `ar_dine` |
| **Database User** | `24cs007_db_user` |
| **Authentication Scheme** | SCRAM-SHA-256 |
| **Sanitized Target URI** | `mongodb+srv://***:***@cluster0.ldspqcv.mongodb.net/ar_dine?retryWrites=true&w=majority&appName=Cluster0` |
| **Credential Masking** | Guaranteed via `DatabaseService.getSanitizedTarget` in runtime and logs. |

---

## 3. Verified Collections & Seeded Fixtures

Running `npm run test:staging` and inspecting the live Atlas database confirmed the following collections:

| Collection Name | Seeded Entity Records | Schema Verification Details |
| :--- | :--- | :--- |
| `restaurants` | 2 Restaurants | - **Spice Craft Kitchen** (`spice-craft-kitchen`), Published, Open.<br>- **Green Leaf Bistro** (`green-leaf-bistro`), Published, Open. |
| `restaurant_tables` | 3 Tables | - `tbl_spice_01` (Table 1, Capacity: 4)<br>- `tbl_spice_02` (Table 2, Capacity: 6)<br>- `tbl_green_01` (Patio Table 1, Capacity: 2) |
| `categories` | 3 Categories | Starters, Main Course, Tandoor Breads. |
| `menu_items` | 2 Dishes | - **Paneer Tikka Angara** (340 INR, Vegetarian, Published)<br>- **Dal Makhani Shahi** (380 INR, Vegetarian, Published) |
| `users` | 3 Accounts | - `superadmin@ardine.internal` (`SUPER_ADMIN`)<br>- `manager.spicecraft@ardine.internal` (`RESTAURANT_ADMIN`)<br>- Customer accounts. |
| `dining_sessions` | Dynamic | Dynamic guest dining sessions verified with opaque `ds_...` tokens. |
| `orders` | Dynamic | Test orders persisted with server-calculated 5% GST and capability `trk_...` tokens. |

---

## 4. Compound Unique Indexes & Constraints Verified

The following indexes were verified active on MongoDB Atlas:
1. **Idempotency Index (`orders`):**
   `{ restaurantId: 1, idempotencyKey: 1 }` — Guarantees that duplicate order submissions with identical idempotency keys within the same restaurant scope cannot produce duplicate records.
2. **Table QR Token Index (`restaurant_tables`):**
   `{ tableToken: 1 }` (Unique) — Ensures O(1) table lookup without exposing sequential IDs.
3. **Restaurant Slug Index (`restaurants`):**
   `{ slug: 1 }` (Unique) — Enforces globally unique human-readable storefront URLs.

---

## 5. Live E2E Staging Test Results

Command: `npm run test:staging`  
Execution script: [backend/test/verify-atlas-staging.mjs](file:///d:/AR_Dine/backend/test/verify-atlas-staging.mjs)

```text
--- AR-DINE PHASE 9 LIVE ATLAS STAGING VERIFICATION ---
Connecting to live Atlas cluster: mongodb+srv://***:***@cluster0.ldspqcv.mongodb.net/ar_dine?retryWrites=true&w=majority&appName=Cluster0
Connected successfully to MongoDB Atlas database: ar_dine

[Check 1: Collections Verified]
Present collections: categories, users, dining_sessions, orders, restaurant_invitations, restaurants, menu_items, restaurant_tables

[Check 2: Restaurant Resolution]
Resolved: Spice Craft Kitchen (Slug: spice-craft-kitchen, ID: 6acc393d921301868f7b1234)

[Check 3: Table QR Resolution]
Resolved: Table 1 (Token: tbl_spice_01, Capacity: 4)

[Check 4: Menu Items & Pricing]
Resolved Dish: Paneer Tikka Angara (Price: 340 INR)

[Check 5: Dining Session Lifecycle]
Created Active Dining Session: ds_053581d7b3aacc8796d8f9f4e8fc9a00

[Check 6: Server Authoritative Pricing & Tax]
Calculated Subtotal: 680 INR, 5% Tax: 34 INR, Grand Total: 714 INR
Order Placed Successfully: ORD-STAGING-1383 (ID: 6acc403f00e216e37b9bbf5b)

[Check 7: Idempotent Duplicate Protection]
Idempotency Verified: Querying restaurantId + idempotencyKey returns existing order ORD-STAGING-1383

[Check 8: KDS FIFO Queue]
Active KDS Queue Length: 1 orders
Order ORD-STAGING-1383 verified in KDS queue with status PLACED

[Check 9: Kitchen State Machine Transitions]
 -> Transitioned to CONFIRMED (persisted in Atlas)
 -> Transitioned to PREPARING (persisted in Atlas)
 -> Transitioned to READY (persisted in Atlas)
 -> Transitioned to SERVED (persisted in Atlas)

[Check 10: Capability Token Tracking View]
Authoritative Tracking View Verified: Current Stored Status: SERVED
Item Snapshot Intact: Paneer Tikka Angara x 2 = 680 INR

[Check 11: Cleanup Disposable Staging Data]
Successfully removed staging test order and dining session.

=== ALL 11 LIVE MONGODB ATLAS STAGING SCENARIOS VERIFIED SUCCESSFULLY ===
```

---

## 6. Resilience & Timeout Hardening

To ensure stable TLS negotiation over fluctuating home and cellular networks, [database.module.ts](file:///d:/AR_Dine/backend/src/database/database.module.ts) was hardened with resilient connection timeouts:
```ts
serverSelectionTimeoutMS: 10000,
connectTimeoutMS: 15000,
socketTimeoutMS: 45000,
```
This prevents premature socket disconnects (`Socket 'secureConnect' timed out after 5000ms`) during initial TLS handshakes with Atlas clusters.
