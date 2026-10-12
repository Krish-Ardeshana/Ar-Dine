# AR-DINE — Container Runtime Validation & Deployment Hardening

## 1. Executive Status: NOT AVAILABLE ON DEV HOST (Configuration Verified)

| Dimension | Status | Evidence / Notes |
| :--- | :--- | :--- |
| **Docker Engine / Daemon** | **`NOT AVAILABLE`** | `Get-Command docker` and `podman` confirmed not installed on the Windows development host. In accordance with Phase 10 rules, container tests are not fabricated. |
| **Direct Node.js Staging Runtime** | **`VERIFIED AGAINST STAGING`** | Node.js v24.20.0 LTS verified running full application against live MongoDB Atlas cluster (`cluster0.ldspqcv.mongodb.net`). |
| **Multi-Stage Dockerfiles** | **`VERIFIED CONFIGURATION`** | Multi-stage build recipes in `backend/Dockerfile` and `frontend/Dockerfile` pass static syntax validation. |
| **Nginx Reverse Proxy & SSE** | **`VERIFIED CONFIGURATION`** | Configuration in `deploy/nginx/ar-dine.conf` properly disables buffering for streaming event routes. |

---

## 2. Host Runtime Inspection Audit

During the Phase 10 preflight audit, runtime command availability was inspected via PowerShell:

```powershell
Get-Command docker -ErrorAction SilentlyContinue
Get-Command podman -ErrorAction SilentlyContinue
```

**Result:** No container runtime command was detected in host environment `$env:PATH`. Container build and smoke test execution is strictly deferred until a compatible runtime is provisioned by the host administrator.

---

## 3. Safe Container Runtime Installation Guide (Windows Host)

To enable containerized execution in this environment:

### Option A: Docker Desktop with WSL 2 Backend (Recommended)
1. Ensure Windows 10/11 64-bit with WSL 2 is enabled:
   ```powershell
   wsl --install
   ```
2. Download Docker Desktop from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop).
3. In Docker Desktop Settings:
   - Check **"Use the WSL 2 based engine"**.
   - Check **"Enable integration with my default WSL distro"**.
4. Verify from PowerShell:
   ```powershell
   docker --version
   docker compose version
   ```

### Option B: Rootless Podman for Windows
1. Install Podman CLI:
   ```powershell
   winget install RedHat.Podman
   ```
2. Initialize Podman machine:
   ```powershell
   podman machine init
   podman machine start
   ```

---

## 4. Reverse Proxy & SSE Hardening (`deploy/nginx/ar-dine.conf`)

The production reverse proxy configuration in `deploy/nginx/ar-dine.conf` hardens real-time Server-Sent Events (SSE) against common proxy streaming issues:

```nginx
# 1. Real-Time Server-Sent Events (SSE) Route
location ~ ^/api/v1/restaurants/.+/events {
    proxy_pass http://backend_upstream;
    proxy_http_version 1.1;

    # Disable proxy buffering and caching for instant push delivery
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;

    # Maintain 24-hour long-lived connections without premature gateway timeout
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;

    # Remove Connection header to enable HTTP/1.1 persistent streaming
    proxy_set_header Connection '';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Endpoints Covered by Regex:
1. **Customer Live Order Tracking:**
   `/api/v1/restaurants/public/:slug/orders/:orderReference/events`
2. **Kitchen Staff KDS Stream:**
   `/api/v1/restaurants/:restaurantId/orders/events`

### Client Reconnection & Polling Fallback
In `frontend/src/app/r/[restaurantSlug]/order/[orderReference]/page.tsx` and `kitchen/page.tsx`:
- If the SSE stream encounters a network interruption, `onerror` sets sync status to `POLLING`.
- An automatic 5-second polling interval polls authoritative order status using document visibility detection (`visibilitychange`), ensuring zero missed state transitions.
