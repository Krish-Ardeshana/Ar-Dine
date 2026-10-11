# AR-DINE — Media Storage & 3D Asset Pipeline

> **Module:** Storage Abstraction & Asset Pipeline  
> **Phase:** Implemented & Verified in Phase 4  
> **API Prefix:** `/api/v1/restaurants/:restaurantId/media`

---

## 1. Storage Abstraction Architecture

AR-DINE decouples file handling from cloud vendors via the `IStorageProvider` interface:

- **`LocalStorageProvider`:** Default zero-dependency provider for local development and offline environments.
  - Files stored securely under `STORAGE_DIR` (default `./storage`).
  - Implements path traversal rejection (`path.normalize` and `path.resolve` boundary check).
- **`CloudinaryStorageProvider`:** External cloud provider configured through environment variables:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - If credentials are omitted, the provider reports `isAvailable() === false` without crashing application startup. Cloud uploads are documented as **NOT CONFIGURED / UNVERIFIED** until credentials are provided.

---

## 2. Supported Formats & File Validation

### 2.1 Food Photography
- **Allowed Formats:** JPEG (`.jpg`, `.jpeg`), PNG (`.png`), WebP (`.webp`).
- **Maximum Size:** 5 MB.
- **Magic Byte Verification:** The backend verifies file binary headers before saving:
  - JPEG: `FF D8 FF`
  - PNG: `89 50 4E 47` (`\x89PNG`)
  - WebP: `RIFF` ... `WEBP`
- **Security:** Rejects renamed executables, corrupt buffers, or mismatched extensions.

### 2.2 Interactive 3D Models
- **Allowed Formats:** Self-contained GLB binary assets (`.glb`).
- **Maximum Size:** 25 MB.
- **Binary Header Verification:** The first 4 bytes of uploaded 3D models must match the ASCII magic integer `'glTF'` (`0x46546C67`).
- **Why Self-Contained GLB?** Standard `.gltf` files depend on separate external `.bin` buffers and image textures that introduce security risks and broken relative URLs. Self-contained `.glb` bundles all geometry and textures into a single validated binary package.

---

## 3. Multi-Tenant Asset Isolation

- Storage keys follow the deterministic format:
  - Images: `restaurants/${restaurantId}/images/${uuid}.${ext}`
  - 3D Models: `restaurants/${restaurantId}/models/${uuid}.glb`
- **Anti-Cross-Tenant Deletion:** The delete endpoint verifies that the incoming `storageKey` begins with `restaurants/${restaurantId}/`. A staff member of Restaurant A cannot delete media belonging to Restaurant B.
