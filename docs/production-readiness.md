# AR-DINE — Production Readiness & Deployment Audit

## 1. Executive Readiness Verdict: VERIFIED WITH LIMITATIONS

The AR-DINE codebase demonstrates architectural maturity, strict multi-tenant isolation, cryptographic capability tracking, and verified state machine enforcement. However, until external production dependencies (live MongoDB Atlas cluster, payment gateway integration, and production HTTPS reverse proxy) are connected and verified in a live staging/production environment, the application is classified as **`VERIFIED WITH LIMITATIONS`**.

---

## 2. Readiness Scorecard by Domain

| Domain | Status | Evidence / Verification Method | Remaining Action Required |
| :--- | :--- | :--- | :--- |
| **Authentication & RBAC** | `VERIFIED` | 26 unit tests & E2E tests passing. Salted password hashing, JWT expiry, and tenant membership checks. | Configure production JWT secrets (>=32 chars). |
| **Multi-Tenant Isolation** | `VERIFIED` | `TenantHelper` and `TenantValidationService` enforce tenant boundaries on all queries. | Monitor cross-tenant index utilization in Atlas. |
| **Menu & Media Pipeline** | `VERIFIED` | Magic number inspection (JPEG, PNG, WebP, GLB), 5MB/25MB limits, path traversal blocks. | Configure Cloudinary or AWS S3 if object storage needed. |
| **Table QR & Sessions** | `VERIFIED` | High-entropy stable QR tokens (`tbl_...`) and dining sessions (`ds_...`). | Calibrate printed QR codes for physical tabletops. |
| **Order Placement & Idempotency** | `VERIFIED` | Authoritative pricing, 5% GST rounding, database compound index `{ restaurantId: 1, idempotencyKey: 1 }`. | Verify Atlas replica-set unique index builds. |
| **Order State Machine** | `VERIFIED` | Atomic conditional updates (`findOneAndUpdate({ _id, status: currentStatus })`), illegal jump rejection. | Validate high-concurrency peak shifts in staging. |
| **Kitchen Display System (KDS)** | `VERIFIED` | Operational UI at `/dashboard/kitchen` with FIFO ticket sorting, elapsed alerts, and transitions. | Verify tablet mounting hardware and viewport rendering. |
| **Real-Time Synchronization** | `VERIFIED` | Server-Sent Events (SSE) with RxJS stream filtering and 5s visibility-aware polling fallback. | Configure reverse proxy `X-Accel-Buffering: no`. |
| **Payment Gateway** | `NOT IMPLEMENTED` | Payment status kept in `PENDING` by design. No simulated or fake payment gateways. | Implement payment gateway integration in future phase. |
| **Live MongoDB Atlas** | `UNVERIFIED` | Unit tests execute on mocks; health check reports `unconfigured` when URI is blank. | Supply live Atlas cluster URI and run seed script. |
| **Physical 3D/AR WebXR** | `UNVERIFIED` | Model-viewer component tested with fallback renders; WebXR AR mode depends on physical hardware. | Test on physical Android/iOS devices with ARCore/ARKit. |

---

## 3. Production Environment Configuration

### 3.1 Backend Environment Variables (`backend/.env`)

```bash
# Server Environment
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://ar-dine.yourdomain.com

# Database Connection (MongoDB Atlas Replica Set)
MONGODB_URI=mongodb+srv://<db_user>:<db_password>@cluster0.mongodb.net/ar_dine?retryWrites=true&w=majority

# Cryptographic Authentication Secrets
JWT_ACCESS_SECRET=<generate_with_openssl_rand_base64_32>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<generate_with_openssl_rand_base64_32>
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=ar-dine-api

# Media Storage Directory (Or Cloudinary configuration)
STORAGE_DIR=/var/data/ar-dine/storage
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### 3.2 Frontend Environment Variables (`frontend/.env.production`)

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.ar-dine.yourdomain.com/api/v1
```

---

## 4. Reverse Proxy & Infrastructure Requirements

When deploying behind an Nginx, Cloudflare, or AWS ALB reverse proxy:
1. **SSE Buffering Disabling**:
   ```nginx
   location /api/v1/restaurants/ {
       proxy_pass http://localhost:4000;
       proxy_http_version 1.1;
       proxy_set_header Connection '';
       proxy_buffering off;
       proxy_cache off;
       chunked_transfer_encoding off;
       proxy_read_timeout 86400s;
   }
   ```
2. **CORS & Cookies**: Ensure `Access-Control-Allow-Credentials: true` is respected when HTTPS is active.
3. **Database Topology**: MongoDB Atlas requires a minimum 3-node replica set for atomic unique index consistency and multi-document transactions.
