# AR-DINE — Production Environment & Runtime Specification

## 1. Overview
This specification details the environment configurations, runtime parameters, secrets hygiene, and resource allocations across staging and production deployments of AR-DINE.

---

## 2. Environment Variables Matrix

### 2.1 Backend API Service (`backend/.env`)

| Variable | Required | Type | Staging / Prod Default | Purpose & Description |
|---|---|---|---|---|
| `NODE_ENV` | Yes | Enum | `production` | Enables Express/NestJS production optimizations |
| `PORT` | Yes | Number | `4000` | TCP port the NestJS HTTP listener binds to |
| `MONGODB_URI` | Yes | String | `mongodb+srv://...` | Connection string for MongoDB Atlas replica set |
| `CORS_ORIGIN` | Yes | String | Domain list | Comma-separated allowed origins (e.g., `https://ar-dine.app`) |
| `FRONTEND_BASE_URL` | Yes | String | Domain | Base URL for QR links and invitation redirect URLs |
| `JWT_ACCESS_SECRET` | Yes | Secret | String (min 32 chars) | Secret key for signing short-lived access tokens (15m) |
| `JWT_REFRESH_SECRET`| Yes | Secret | String (min 32 chars) | Secret key for signing refresh tokens (7d) |
| `STORAGE_PROVIDER` | No | Enum | `local` \| `cloudinary` | Media storage mechanism (defaults safely to `local`) |
| `STORAGE_DIR` | No | String | `/usr/src/app/storage` | Local directory for uploaded photos and 3D models |
| `CLOUDINARY_CLOUD_NAME` | Cond. | String | - | Cloudinary cloud account name (when provider is cloudinary) |
| `CLOUDINARY_API_KEY` | Cond. | String | - | Cloudinary REST API key |
| `CLOUDINARY_API_SECRET` | Cond. | Secret | - | Cloudinary REST API secret |
| `PAYMENT_GATEWAY` | No | Enum | `sandbox` | Gateway provider (`sandbox`, `razorpay`, `stripe`) |
| `PAYMENT_WEBHOOK_SECRET` | Cond. | Secret | String (min 16 chars) | Webhook HMAC verification secret |

### 2.2 Frontend Client Service (`frontend/.env.production`)

| Variable | Required | Type | Target Value | Purpose & Description |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | String | `https://api.ar-dine.app/api/v1` or `/api/v1` | Public API endpoint for browser calls |
| `NEXT_TELEMETRY_DISABLED` | No | Boolean | `1` | Disables Next.js anonymous build telemetry |

---

## 3. Secrets Management & Zero-Leakage Policy

1. **Client-Side Safety:** No secrets or private keys prefixed without `NEXT_PUBLIC_` may exist in the frontend workspace.
2. **Repository Protection:** `.env` files are strictly added to `.gitignore`. Only `.env.example` templates containing sanitized placeholders are committed.
3. **Database Credentials:** MongoDB connection strings must encode credentials via URI percent-encoding and must only be passed through secured server-side environment variables or secret managers (e.g. AWS Secrets Manager, HashiCorp Vault).

---

## 4. Container & Process Runtime Specification

### 4.1 Process Architecture
- **Process Model:** Single-process asynchronous event loop per instance.
- **Node.js Flags:** `--max-old-space-size=2048` recommended for container instances with 4GB RAM to prevent premature OOM.
- **Graceful Shutdown:** Handles `SIGTERM` and `SIGINT` signals with NestJS shutdown hooks (`enableShutdownHooks()`), draining in-flight requests and closing Mongoose connection pool within a 10s grace period.

### 4.2 Network & Ingress Security
- **Strict HTTPS:** All public traffic terminates at the reverse proxy (TLS 1.3 / TLS 1.2).
- **SSE Long-Polling Exemption:** Ingress proxy buffering is disabled specifically for `/events` routes to support perpetual Server-Sent Events streams.
- **Container Isolation:** In containerized setups, backend and database communicate over internal isolated bridge networks (`ardine-network`), exposing only public reverse-proxy ports (80/443).
