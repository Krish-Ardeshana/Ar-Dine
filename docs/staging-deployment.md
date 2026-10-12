# AR-DINE — Live Staging Deployment & Topology Verification

## 1. Overview & Operational Preflight

Phase 9 transitions AR-DINE from deployment configuration preparation into an actively verified, live staging environment with direct connectivity to a MongoDB Atlas cloud cluster.

### Preflight Dependency Inventory
| Component | Verified State | Status Label | Operational Context |
| :--- | :--- | :--- | :--- |
| **Node.js LTS** | `v24.20.0` | `VERIFIED` | Host development & staging runtime. |
| **npm** | `11.19.0` | `VERIFIED` | Dependency manager & script runner. |
| **Git** | `2.56.0` | `VERIFIED` | Version control on branch `main`. |
| **MongoDB Atlas** | Primary Shard Connected | `VERIFIED` | Live cluster at `cluster0.ldspqcv.mongodb.net`. |
| **Backend API Server** | Port 4000 (`/api/v1`) | `VERIFIED` | Live NestJS process connected to Atlas. |
| **Frontend Web App** | Port 3000 | `VERIFIED` | Live Next.js 16 App Router process with Turbopack. |
| **Docker Engine / CLI** | Not Installed | `NOT_AVAILABLE` | Docker CLI/daemon not installed on Windows host; multi-stage Dockerfiles and Compose are verified as syntactically sound. |
| **Cloudinary Asset Storage**| Credentials Unset | `UNVERIFIED` | No external API keys provided; local storage provider active. |
| **Physical AR Hardware** | No Mobile Test Rig | `NOT_VERIFIED` | 3D viewer operational in desktop/browser mode; WebXR hardware unverified. |

---

## 2. Active Staging Topology

```
[ Browser / Client ] ─── HTTP (Port 3000) ───► [ Next.js 16 Frontend App Router ]
         │
         └───────────── HTTP / SSE (Port 4000) ───► [ NestJS 12 Backend API Gateway ]
                                                              │
                                                              ▼ TLS 1.3 / SRV
                                            [ MongoDB Atlas Dedicated 3-Node Cluster ]
                                            Host: ac-qsnbbl3-shard-00-00.ldspqcv.mongodb.net
                                            Database: ar_dine
```

### 2.1 Backend Process Verification
- **Port:** `4000`
- **Prefix:** `/api/v1`
- **Health Endpoint:** `http://localhost:4000/api/v1/health`
- **Verified Response:**
  ```json
  {
    "status": "ok",
    "service": "ar-dine-backend",
    "environment": "development",
    "uptime": 114,
    "database": {
      "status": "connected",
      "ready": true,
      "databaseName": "ar_dine",
      "host": "ac-qsnbbl3-shard-00-00.ldspqcv.mongodb.net"
    }
  }
  ```

### 2.2 Frontend Process Verification
- **Port:** `3000`
- **Status:** HTTP 200 OK
- **Configuration:** [frontend/.env.local](file:///d:/AR_Dine/frontend/.env.local) targeting `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1`.

---

## 3. Reverse Proxy & SSE Production Requirements

The repository includes a ready-to-deploy Nginx reverse proxy template at [deploy/nginx/ar-dine.conf](file:///d:/AR_Dine/deploy/nginx/ar-dine.conf).

### Crucial SSE Ingress Rule
To prevent reverse proxies from buffering SSE event streams between NestJS and guest tracking pages, proxy buffering must remain disabled:
```nginx
location ~ ^/api/v1/restaurants/.+/events {
    proxy_pass http://backend_upstream;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;
    proxy_read_timeout 86400s;
    proxy_set_header Connection '';
}
```

---

## 4. Disaster Recovery & Rollback Strategy

1. **Database Recovery:**
   - Seed script is strictly idempotent: `npm run seed` uses `findOneAndUpdate` with `$set` to prevent duplicate record insertion.
   - Production safety barrier: Seed execution aborts immediately if `NODE_ENV === 'production'`.
2. **Graceful Process Shutdown:**
   - On `SIGTERM` / `SIGINT`, `DatabaseService.onApplicationShutdown()` cleanly closes active Mongoose connections to Atlas without terminating in-flight operations prematurely.
