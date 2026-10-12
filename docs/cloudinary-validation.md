# AR-DINE — Cloudinary & Media Storage Integration Audit

## 1. Executive Status: UNVERIFIED (Local Storage Active)

The external Cloudinary cloud media storage provider is currently classified as **`UNVERIFIED`**.

### Current Configuration State
- `CLOUDINARY_CLOUD_NAME`: Unconfigured (Blank in `backend/.env`)
- `CLOUDINARY_API_KEY`: Unconfigured
- `CLOUDINARY_API_SECRET`: Unconfigured
- Operational Media Provider: **`LocalStorageProvider`** (Fully Operational & Verified)

In accordance with Phase 9 testing rules, external cloud uploads are not fabricated without live credentials.

---

## 2. Active Local Storage Provider (`LocalStorageProvider`)

The platform includes a zero-dependency, secure local filesystem storage provider configured at `STORAGE_DIR=./storage`.

### Security Protections Verified (8 Unit Tests Passing in `media.service.spec.ts`)
1. **Magic Number Inspection:**
   - **JPEG:** Enforces `0xFF 0xD8 0xFF` header byte signature.
   - **PNG:** Enforces `0x89 0x50 0x4E 0x47` header byte signature.
   - **WebP:** Enforces `RIFF` and `WEBP` header byte signatures.
   - **3D GLB:** Enforces `glTF` (ASCII `0x67 0x6C 0x54 0x46`) binary header signature.
2. **File Size Caps:**
   - Images capped at 5 MB maximum.
   - 3D GLB Models capped at 25 MB maximum.
3. **Path Traversal Defense:**
   - Normalizes all paths and strips directory climbing sequences (`../`).
   - Asserts `absoluteTarget.startsWith(baseStorageDir)`, throwing `400 Bad Request` if path escape is attempted.
4. **Tenant Scoped Media Deletion:**
   - Storage keys strictly enforce prefix `restaurants/{restaurantId}/`. Staff members cannot delete assets belonging to other restaurants.

---

## 3. How to Enable Cloudinary in Staging/Production

To switch asset delivery from local storage to Cloudinary CDN:
1. Create a free or paid Cloudinary account at [cloudinary.com](https://cloudinary.com).
2. Obtain your API credentials from the Cloudinary Dashboard.
3. Update `backend/.env`:
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
4. Restart the backend service. `CloudinaryStorageProvider.isAvailable()` will automatically evaluate to `true`.
