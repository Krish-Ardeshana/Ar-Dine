# AR-DINE — Cloud Media Storage Integration (Cloudinary)

## 1. Executive Status: UNVERIFIED (Production Code Verified Locally)

| Dimension | Status | Evidence / Notes |
| :--- | :--- | :--- |
| **Live External Cloud Storage** | **`UNVERIFIED`** | Credentials not configured in local environment (`backend/.env`). No mock results fabricated. |
| **Provider Implementation** | **`VERIFIED LOCALLY`** | 9 unit tests passing in `cloudinary-storage.provider.spec.ts`. Signed REST integration tested with simulated upstream responses. |
| **Local Storage Provider** | **`VERIFIED LOCALLY`** | 6 unit tests passing in `local-storage.provider.spec.ts`. Enforces path isolation, magic bytes, and tenant scoping. |
| **Provider Selection & Fallback** | **`VERIFIED LOCALLY`** | 3 unit tests in `media.service.spec.ts`. Automatic fallback to `LocalStorageProvider` when unconfigured. |

---

## 2. Architecture & Design

### Storage Provider Abstraction (`IStorageProvider`)
The media subsystem decouples application controllers and business logic from specific cloud storage vendors:

```typescript
export interface StorageUploadResult {
  url: string;
  storageKey: string;
  format: string;
  fileSizeBytes: number;
}

export interface IStorageProvider {
  readonly name: string;
  isAvailable(): boolean;
  uploadFile(file: UploadedFileDto, storagePath: string): Promise<StorageUploadResult>;
  deleteFile(storageKey: string): Promise<void>;
}
```

### Zero-Dependency REST Implementation
`CloudinaryStorageProvider` communicates directly with Cloudinary's v1_1 REST API using Node.js built-in `fetch`, `FormData`, `Blob`, and `node:crypto`. No bloated third-party SDK dependencies are required.

- **Image Endpoint:** `POST https://api.cloudinary.com/v1_1/<cloud_name>/image/upload`
- **3D Model (GLB) Endpoint:** `POST https://api.cloudinary.com/v1_1/<cloud_name>/raw/upload`
- **Asset Destruction Endpoint:** `POST https://api.cloudinary.com/v1_1/<cloud_name>/<resource_type>/destroy`

### Cryptographic Signature & Authentication
All uploads and deletions are signed server-side using SHA-1 over sorted query parameters concatenated with `apiSecret`:

$$\text{Signature} = \text{SHA1}(\text{"public\_id="} + \text{publicId} + \text{"&timestamp="} + \text{timestamp} + \text{apiSecret})$$

Credentials (`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) remain strictly on the backend server and are never delivered to the client frontend or exposed in logs.

---

## 3. Dynamic Selection & Fail-Safe Fallback

`MediaService` inspects the environment variable `STORAGE_PROVIDER`:

1. **`STORAGE_PROVIDER=local` (Default):**
   Uses `LocalStorageProvider`. Assets are persisted to `./storage` and served statically or via reverse proxy CDN.
2. **`STORAGE_PROVIDER=cloudinary` (Configured):**
   If `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are all set, `MediaService` uses `CloudinaryStorageProvider`.
3. **`STORAGE_PROVIDER=cloudinary` (Unconfigured or Missing Credentials):**
   `MediaService` logs a prominent warning and falls back safely to `LocalStorageProvider`, ensuring continuous uptime and preventing deployment crashes.

---

## 4. Error Handling and Security Guarantees

1. **Secret Sanitization:**
   Upload and destroy errors sanitize upstream payloads. The `apiSecret` and authorization headers are never included in exception messages, client responses, or system logs.
2. **No Silent Deletion Failures:**
   If Cloudinary deletion fails or returns an HTTP status $\ge 400$, `CloudinaryStorageProvider` throws a `BadGatewayException` rather than reporting false successful cleanup.
3. **Tenant Prefix Isolation:**
   All public identifiers enforce the tenant scoping prefix:
   - Images: `restaurants/<restaurantId>/images/<uuid>`
   - 3D Models: `restaurants/<restaurantId>/models/<uuid>.glb`
4. **Clean Failure Transactions:**
   If a media upload fails, no database record is created. The database metadata remains completely consistent.

---

## 5. Enabling Live Cloudinary in Staging / Production

To enable live Cloudinary storage:

1. Obtain credentials from your Cloudinary Console dashboard.
2. Configure environment variables in `backend/.env`:
   ```env
   STORAGE_PROVIDER=cloudinary
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
3. Restart the backend service. `MediaService` will automatically detect the credentials and switch active provider to `CloudinaryStorageProvider`.
