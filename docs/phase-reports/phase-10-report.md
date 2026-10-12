# AR-DINE — Phase 10 Engineering Report
## Cloud Media Storage, Physical AR Validation & Deployment Hardening

**Project:** AR-DINE — AR Smart Restaurant Management System (College Project-I, CEUP301)  
**Repository:** `D:\AR_Dine`  
**Base Commit:** `24ad5bb`  
**Execution Timestamp:** 2026-10-12  
**Status:** **PHASE 10 COMPLETE**

---

## 1. Executive Summary & Verification Matrix

Phase 10 hardened the media storage subsystem, audited physical-device AR readiness, implemented platform-specific AR launching attributes, verified Nginx SSE proxy configurations, and expanded test coverage without breaking any Phase 0–9 functionality.

In accordance with strict evidence-based execution rules, capabilities requiring external cloud credentials, physical mobile sensors, or unavailable container engines are honestly classified rather than fabricated:

| Subsystem / Capability | Verification Status | Evaluation Details |
| :--- | :--- | :--- |
| **External Cloudinary Cloud Storage** | **`UNVERIFIED`** | Cloud credentials (`CLOUDINARY_*`) remain unconfigured in local `backend/.env`. No simulated upload results fabricated. |
| **Cloudinary Provider Implementation** | **`VERIFIED LOCALLY`** | 9 unit tests passing in `cloudinary-storage.provider.spec.ts`. Signed REST integration tested with simulated upstream responses. |
| **Local Storage Provider** | **`VERIFIED LOCALLY`** | 6 unit tests passing in `local-storage.provider.spec.ts`. Strict path traversal defense and file type validation. |
| **Storage Fail-Safe Fallback** | **`VERIFIED LOCALLY`** | `MediaService` automatically falls back to `LocalStorageProvider` when Cloudinary is unconfigured. |
| **Media Security & Tenant Isolation** | **`VERIFIED LOCALLY`** | Binary magic byte verification (JPEG, PNG, WebP, GLB), tenant prefix scoping (`restaurants/<id>/`), and path traversal defenses. |
| **Historical Order Integrity** | **`VERIFIED AGAINST STAGING`** | `OrderItemSnapshot` protects historical orders from menu edits; soft-archiving preserves order auditability. |
| **3D `<model-viewer>` Component** | **`VERIFIED LOCALLY`** | Web component with Orbit controls, auto-rotate, shadow softness, photographic fallback, and error handling. |
| **iOS Quick Look & Accessibility** | **`VERIFIED LOCALLY`** | Added `iosSrc` (`ios-src`) prop for USDZ Quick Look; added explicit `aria-label` attributes to AR controls. |
| **Physical Mobile AR Session** | **`NOT VERIFIED`** | No physical mobile device (Android ARCore / iOS ARKit) connected to test host. Detailed manual checklist provided. |
| **Host Container Engine (Docker)** | **`NOT AVAILABLE`** | Docker CLI and daemon not installed on Windows host. Direct Node.js LTS staging runtime verified. |
| **Nginx Reverse Proxy & SSE Streaming** | **`VERIFIED CONFIGURATION`** | `deploy/nginx/ar-dine.conf` verified with unbuffered streaming headers (`proxy_buffering off;`) and 86400s timeouts. |
| **Live MongoDB Atlas Staging Suite** | **`VERIFIED AGAINST STAGING`** | 11 / 11 end-to-end integration scenarios passed against live Atlas cluster (`cluster0.ldspqcv.mongodb.net`). |
| **Backend Unit & E2E Suites** | **`VERIFIED LOCALLY`** | 173 unit tests (22 files) + 25 E2E tests (2 files) passing cleanly. |

---

## 2. Cloud Media Storage Audit (Cloudinary vs Local)

### A. Real Cloud Credentials Status
Inspection of `backend/.env` confirmed:
- `CLOUDINARY_CLOUD_NAME`: Unset
- `CLOUDINARY_API_KEY`: Unset
- `CLOUDINARY_API_SECRET`: Unset

In compliance with execution rules, live cloud uploads are classified as **`UNVERIFIED`**.

### B. Provider Implementation & Security Hardening
`CloudinaryStorageProvider` (`backend/src/media/providers/cloudinary-storage.provider.ts`) was upgraded from a stub to a production-ready, zero-dependency REST integration:
1. **Direct Signed REST Calls:** Uses Node.js built-in `fetch`, `FormData`, `Blob`, and `node:crypto`.
2. **SHA-1 Signature Generation:** Server-side signature calculated using sorted query parameters + `apiSecret`. Credentials never leave the backend server.
3. **Resource Type Handling:** Routes JPEG/PNG/WebP to `/image/upload` and 3D GLB assets to `/raw/upload`.
4. **Failure Resiliency:** Deletion failures throw `BadGatewayException` rather than reporting silent success.
5. **Secret Sanitization:** Error handlers sanitize messages so API secrets are never logged or returned in HTTP responses.

### C. Local Storage Hardening (`LocalStorageProvider`)
1. Hardened path traversal verification using `path.relative(this.baseStorageDir, absoluteTarget)` and explicit rejection of `..` sequences.
2. Verified `fs.stat.isFile()` before unlinking during deletions to prevent directory tampering.

---

## 3. Physical AR Readiness & Implementation Audit

### A. Frontend Model Viewer Upgrades
`ModelViewer.tsx` (`frontend/src/components/ModelViewer.tsx`) and `types/model-viewer.d.ts` were enhanced:
1. **iOS Quick Look Integration:** Added `iosSrc` (`ios-src`) prop to pass USDZ model URLs directly to Apple's native Quick Look engine on Safari.
2. **AR Attributes:** Configured `ar-scale="auto"` and `quick-look-browsers="safari"`.
3. **Accessibility:** Added descriptive `aria-label="Reset 3D camera viewpoint"` and `aria-label="Launch Augmented Reality camera session"`.
4. **AR Status Feedback:** UI displays dynamic state pill ("AR Ready (WebXR)" vs "Interactive 3D Preview").

### B. Graceful Degradation Verified
- **No 3D Model:** Renders high-resolution 2D dish image or placeholder with clear status indicator.
- **Model Load Error:** Renders dimmed photographic view and informative non-blocking warning card.
- **Desktop Browser:** Displays full 3D interactive orbit viewer; AR button is hidden when device reports `canActivateAR = false`.

### C. Physical Hardware Verification
Physical mobile AR is classified as **`NOT VERIFIED`** due to lack of connected mobile test hardware. Complete manual testing checklists for Android (WebXR / Scene Viewer) and iOS (Safari Quick Look) are documented in [`docs/physical-ar-validation.md`](file:///d:/AR_Dine/docs/physical-ar-validation.md).

---

## 4. Deployment Runtime & Proxy Hardening

### A. Container Engine Inspection
PowerShell inspection confirmed `docker` and `podman` are not installed on the Windows development host (`NOT AVAILABLE`).
- Direct Node.js LTS (v24.20.0) staging runtime remains the verified deployment path.
- Installation guidelines for Docker Desktop on Windows with WSL 2 are documented in [`docs/container-runtime-validation.md`](file:///d:/AR_Dine/docs/container-runtime-validation.md).

### B. SSE Streaming & Reverse Proxy Audit
`deploy/nginx/ar-dine.conf` was verified against streaming requirements:
- **Location Matching:** `location ~ ^/api/v1/restaurants/.+/events` regex covers both customer live order tracking and kitchen KDS streams.
- **Buffering Disabled:** `proxy_buffering off; proxy_cache off; chunked_transfer_encoding off;`.
- **Stream Timeouts:** `proxy_read_timeout 86400s; proxy_send_timeout 86400s;`.
- **Client Fallback:** Frontend order tracking and KDS pages maintain a 5-second visibility-aware polling fallback in case of connection interruptions.

---

## 5. Comprehensive Quality Gate Results

### A. Backend Unit Tests
- **Command:** `npm test`
- **Result:** **173 passed** across 22 test files (up from 155 in Phase 9).
- **Duration:** 2.66s.

### B. Backend E2E Tests
- **Command:** `npm run test:e2e`
- **Result:** **25 passed** across 2 test files (`app.e2e-spec.ts` & `production-smoke.e2e-spec.ts`).
- **Duration:** 2.72s (configured 30s timeout handles remote Atlas latency).

### C. Live Atlas Staging Verification
- **Command:** `npm run test:staging`
- **Result:** **11 / 11 scenarios passed** with full disposable lifecycle cleanup:
  1. Collections Verified
  2. Restaurant Resolution
  3. Table QR Resolution
  4. Menu Items & Pricing
  5. Dining Session Lifecycle
  6. Server Authoritative Pricing & Tax
  7. Idempotent Duplicate Protection
  8. KDS FIFO Queue
  9. Kitchen State Machine Transitions (`PLACED` → `CONFIRMED` → `PREPARING` → `READY` → `SERVED`)
  10. Capability Token Tracking View
  11. Cleanup Disposable Staging Data

### D. Backend Lint & Build
- **Command:** `npm run lint` → Oxlint: **0 errors, 0 warnings** across 116 files.
- **Command:** `npm run build` → NestJS compilation: **0 errors**.

### E. Frontend Lint & Build
- **Command:** `npm run lint` → ESLint: **0 errors**.
- **Command:** `npm run build` → Next.js 16 (Turbopack): **15 / 15 static & dynamic routes compiled with 0 errors**.

---

## 6. Git Hygiene & Commit History

Four focused local commits were created on branch `main`:

| Commit Hash | Commit Type | Description |
| :--- | :--- | :--- |
| `4761efe` | `test(media)` | Verify storage provider behavior and path traversal protection |
| `11d70fc` | `test(ar)` | Improve model viewer fallback and iOS Quick Look support |
| `92529eb` | `chore(deploy)` | Harden test timeouts and template literal types |
| `8f06a28` | `docs(phase-10)` | Document media storage, AR validation, and deployment hardening |

- **Remote Push:** Strictly withheld in compliance with execution rules.
- **Secrets Audit:** Verified that `.env` and `.env.local` are untracked and excluded by `.gitignore`.

---

## 7. Deliverables & Documentation Created

1. [`docs/cloudinary-integration.md`](file:///d:/AR_Dine/docs/cloudinary-integration.md) — Cloudinary REST architecture, signatures, and fallback strategy.
2. [`docs/physical-ar-validation.md`](file:///d:/AR_Dine/docs/physical-ar-validation.md) — AR launch mechanics, HTTPS requirement, and manual physical device checklist.
3. [`docs/media-security.md`](file:///d:/AR_Dine/docs/media-security.md) — Binary magic byte verification, path isolation, and historical order snapshot protections.
4. [`docs/container-runtime-validation.md`](file:///d:/AR_Dine/docs/container-runtime-validation.md) — Docker status, Windows installation guide, and Nginx SSE hardening.
5. [`docs/phase-reports/phase-10-report.md`](file:///d:/AR_Dine/docs/phase-reports/phase-10-report.md) — Comprehensive Phase 10 engineering report.
6. [`README.md`](file:///d:/AR_Dine/README.md) — Updated implementation status checklist.
