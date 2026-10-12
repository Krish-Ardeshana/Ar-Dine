# AR-DINE — MongoDB Atlas Cluster Provisioning & Setup Guide

## 1. Status Notice & Current Classification

> **Current Environment Status:** **`UNVERIFIED`**  
> In accordance with Phase 7 & 8 testing integrity standards, live Atlas cluster connectivity remains unverified in this local workspace because no external Atlas credentials were configured. The codebase is fully verified against in-memory schema mock suites, and health check diagnostics correctly report `status: "unconfigured", ready: false` when credentials are absent.

---

## 2. Atlas Provisioning Workflow

### 2.1 Cluster Tier Selection
- **Development & Staging:** Shared Cluster (M0 Free Tier or M2/M5 Shared).
- **Production:** Dedicated Cluster (M10+ Minimum) across a 3-Node Replica Set. A 3-node replica set is mandatory for:
  - Multi-document ACID transaction guarantees.
  - Automatic primary failover without downtime.
  - Deterministic unique constraint checks on compound indexes.

### 2.2 Network Security & IP Access Lists
1. In MongoDB Atlas console, navigate to **Security → Network Access**.
2. Avoid setting `0.0.0.0/0` (Allow Access from Anywhere) in production environments.
3. Whitelist:
   - Specific static IP addresses of backend application servers / ECS NAT Gateways.
   - Or configure **VPC Peering / AWS PrivateLink** for cloud-to-cloud security.

### 2.3 Least-Privilege Database Users
1. In Atlas console, navigate to **Security → Database Access**.
2. Create a dedicated application user (e.g. `ardine_api_worker`).
3. Set authentication method to **Password** (minimum 24 characters).
4. Assign custom or built-in roles:
   - Scoped database: `ar_dine`
   - Role: `readWrite`
   - **DO NOT assign `atlasAdmin` or cluster-level administrative roles.**

---

## 3. Connection String Formatting

Format the production connection string as an SRV URI:
```text
mongodb+srv://<db_user>:<db_password>@cluster0.yourprefix.mongodb.net/ar_dine?retryWrites=true&w=majority&appName=ArDineBackend
```

### Connection String Components
- `mongodb+srv://`: DNS seed list connection format.
- `retryWrites=true`: Automatically retries write operations on transient network drops.
- `w=majority`: Ensures writes are acknowledged by the majority of replica set nodes before returning success.
- `appName=ArDineBackend`: Identifies the client connection in Atlas Profiler.

---

## 4. Compound Indexes & Schema Guarantees

Upon successful connection, the backend ensures the following critical indexes:

| Collection | Index Specification | Type | Business Criticality |
| :--- | :--- | :--- | :--- |
| `orders` | `{ restaurantId: 1, idempotencyKey: 1 }` | Compound Unique | Prevents duplicate order placement from multiple client submissions. |
| `restauranttables` | `{ restaurantId: 1, tableNumber: 1 }` | Compound Unique | Prevents duplicate table numbers within the same tenant. |
| `restauranttables` | `{ tableToken: 1 }` | Unique | Accelerates public QR customer lookup. |
| `restaurants` | `{ slug: 1 }` | Unique | Canonical URL resolution for restaurant storefronts. |
| `users` | `{ email: 1 }` | Unique | Prevents duplicate account registration. |

---

## 5. Seed Script & Initial Fixture Population

Once a staging or development database URI is set in `backend/.env`:
```powershell
# Populate sample restaurants (Mumbai Spice, Bistro Paris), menus, tables, and staff
npm run seed
```

> [!CAUTION]
> The seed script automatically aborts if `NODE_ENV === 'production'` to protect live customer records from accidental wiping.
