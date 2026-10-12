# AR-DINE — Production Deployment Architecture & Hosting Strategy

## 1. Architectural Overview & System Topology

AR-DINE is a multi-tenant Augmented Reality restaurant management system architected around two core application tiers and external managed infrastructure:

```
[ Client Devices: Mobile Guest Browsers / Kitchen Display Tablets ]
                              │
                              ▼ (HTTPS / WSS / TLS 1.3)
       ┌──────────────────────────────────────────────┐
       │     Reverse Proxy & Edge Ingress Layer       │
       │   (Nginx / Cloudflare / AWS ALB / Caddy)     │
       └──────────────────────┬───────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               │                             │
    (Next.js Web Traffic)           (API & SSE Traffic)
               │                             │
               ▼                             ▼
┌─────────────────────────────┐ ┌────────────────────────────────────────┐
│     Frontend Service        │ │          Backend API Service           │
│  Next.js 16 (App Router)    │ │   NestJS 12 (TypeScript Modular API)   │
│  - Port 3000                │ │   - Port 4000 (Prefix /api/v1)         │
│  - Static & PPR Delivery    │ │   - Stateful In-Memory RxJS SSE Streams│
│  - WebXR model-viewer Host  │ │   - Multi-Tenant RBAC Security Kernel  │
└─────────────────────────────┘ └───────────────────┬────────────────────┘
                                                    │
                      ┌─────────────────────────────┴─────────────────────┐
                      │                                                   │
                      ▼                                                   ▼
       ┌──────────────────────────────┐                ┌──────────────────────────────┐
       │   Database Persistence       │                │    Persistent Media Storage  │
       │   MongoDB Atlas Replica Set  │                │    - Local Docker Volume     │
       │   (3-Node M10+ Dedicated)    │                │    - Cloudinary Cloud Assets │
       └──────────────────────────────┘                └──────────────────────────────┘
```

---

## 2. Component Specifications

### 2.1 Next.js 16 Frontend Service
- **Runtime:** Node.js 22 LTS or Next.js Edge Runtime where supported.
- **Port:** `3000` (Default).
- **Key Characteristics:**
  - Employs React 19 and Next.js 16 with Partial Prerendering (PPR) and Turbopack.
  - Zero sensitive secrets embedded in client bundles; communicates exclusively via `NEXT_PUBLIC_API_BASE_URL`.
  - Hosts Google `<model-viewer>` web components for 3D GLB dishes with WebXR device fallback.

### 2.2 NestJS 12 Backend API Service
- **Runtime:** Node.js 22 LTS container or long-running Node process.
- **Port:** `4000` (Default, prefixed with `/api/v1`).
- **Stateful Streaming:**
  - Implements Server-Sent Events (SSE) via RxJS `Subject<OrderEventPayload>` for real-time KDS and guest order tracking.
  - **CRITICAL DEPLOYMENT REQUIREMENT:** Must run as a persistent, long-lived server process. Serverless platforms with 10s–30s execution timeouts (e.g. AWS Lambda, basic Vercel Serverless Functions) will terminate active SSE streams and force constant reconnections.
  - Accommodates graceful shutdown via `OnApplicationShutdown` hooks, closing open Mongoose connections on `SIGTERM` / `SIGINT`.

### 2.3 MongoDB Atlas Persistence Layer
- **Minimum Production Topology:** 3-Node Replica Set (Primary + 2 Secondaries).
- **Target Version:** MongoDB 7.0+ / 8.0+.
- **Guarantees:**
  - Multi-document ACID transactions.
  - Enforced compound unique indexes: `{ restaurantId: 1, idempotencyKey: 1 }`, `{ restaurantId: 1, tableNumber: 1 }`.
  - Lazy connection initialization with connection pool size 10–50 and server selection timeout 3000ms.

### 2.4 Media Storage Providers
- **Local Disk Mode (`LocalStorageProvider`):**
  - Mounts a persistent Docker volume at `/usr/src/app/storage`.
  - Validates magic byte signatures (JPEG, PNG, WebP, GLB).
  - Sanitizes paths against directory traversal attacks.
- **Cloud Provider Mode (`CloudinaryStorageProvider`):**
  - Configurable via `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
  - External CDN offload for high-bandwidth 3D GLB models.

---

## 3. Hosting Platform Compatibility Matrix

| Platform | Frontend Compatibility | Backend Compatibility | SSE & Long-Lived Streams | Persistent Local Storage | Recommended Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Docker Compose / Self-Hosted VPS** | Full Support | Full Support | Excellent (Direct TCP) | Full Support (Docker volumes) | **Recommended for Staging & On-Premises** |
| **AWS ECS / Fargate** | Full Support | Full Support | Excellent (ALB with idle timeout adjusted) | Supported via AWS EFS | **Recommended for Enterprise Production** |
| **Render.com** | Full Support (Static / Web Service) | Full Support (Web Service) | Supported (HTTP/2 streaming) | Supported via Render Persistent Disks | **Recommended for Team Staging** |
| **Railway.app** | Full Support | Full Support | Supported | Supported via Railway Volumes | Viable Alternative |
| **Vercel** | Ideal Host | Incompatible for SSE | Severely Limited (Serverless function execution caps) | Incompatible (Ephemeral filesystem) | Frontend Only |

---

## 4. Reverse Proxy & SSE Ingress Configuration

When deploying behind an Nginx or Cloudflare reverse proxy, Server-Sent Events (SSE) will silently fail or suffer delayed packet delivery if proxy buffering is enabled.

### 4.1 Mandatory Nginx Directives for `/api/v1/restaurants/.+/events`
1. `proxy_buffering off;` — Disables Nginx buffering so chunks flush to client sockets instantly.
2. `proxy_cache off;` — Prevents intermediate caches from holding event payloads.
3. `chunked_transfer_encoding off;` — Ensures standard SSE text/event-stream content delivery.
4. `proxy_read_timeout 86400s;` — Extends socket read timeout from default 60s to 24h, preventing proxy drops.
5. `proxy_set_header Connection '';` — Enables HTTP/1.1 persistent keepalive upstream.

### 4.2 Cloudflare Specifics
- If proxying through Cloudflare (Orange Cloud), ensure **Buffering** is disabled for the SSE route by adding a Cache Rule: `Eligible for cache: Bypass cache`.

---

## 5. High Availability & Deployment Strategies

### 5.1 Rolling Update Strategy
- Deploy backend containers in a minimum pool of 2 instances behind an Application Load Balancer.
- Update one container at a time. The health check endpoint (`/api/v1/health`) must report `status: "ok"` before traffic shifts.
- Frontend tracking clients utilize automatic polling fallback (`syncStatus === 'POLLING'`) if a rolling update temporarily severs an SSE socket.

### 5.2 Rollback Procedures
- **Database Migrations:** Schema design maintains additive, non-breaking schema evolution.
- **Container Rollback:** If health checks fail post-deployment, traffic is routed back to the previous immutable container image tag.
