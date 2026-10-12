# AR-DINE — Environment Configuration & Secrets Management Guide

## 1. Overview & Security Principles

AR-DINE enforces strict environment separation and startup validation via NestJS `class-validator` and `class-transformer` rules in [env.validation.ts](file:///d:/AR_Dine/backend/src/config/env.validation.ts).

### Core Security Tenets
1. **Zero Secret Leakage:** Never commit `.env` or `.env.*` files (guaranteed by [.gitignore](file:///d:/AR_Dine/.gitignore)).
2. **Zero In-Log Secrets:** Connection strings and tokens are automatically masked via `DatabaseService.getSanitizedTarget` (`mongodb+srv://***:***@...`).
3. **Fail-Fast Production Boot:** Booting with `NODE_ENV=production` fails immediately if cryptographic secrets fail entropy requirements.
4. **Client Secret Isolation:** Only environment variables prefixed with `NEXT_PUBLIC_` are exposed to client-side bundles.

---

## 2. Backend Environment Variables Reference

| Variable Name | Type | Allowed Values / Format | Default | Required in Production | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | `enum` | `development`, `production`, `test` | `development` | **Yes** | Server operational environment. Controls strict security validations. |
| `PORT` | `number` | Positive integer (e.g. `4000`) | `4000` | Optional | Port on which the NestJS HTTP listener binds. |
| `CORS_ORIGIN` | `string` | Comma-separated URLs | `http://localhost:3000` | **Yes** | Allowed CORS origins for frontend client requests. **Wildcard `*` strictly forbidden in production.** |
| `FRONTEND_BASE_URL` | `string` | Canonical HTTPS URL | `http://localhost:3000` | **Yes** | Canonical origin used by `QrService` to generate customer tabletop QR URLs. |
| `MONGODB_URI` | `string` | MongoDB Atlas Replica Set URI | None (Unconfigured mode) | **Yes** | Database connection string. When unset, runs in unconfigured offline mode. |
| `JWT_ACCESS_SECRET` | `string` | Min 32 characters | None | **Yes (>=32 chars)** | Cryptographic secret for signing short-lived (15m) JWT access tokens. |
| `JWT_ACCESS_EXPIRES_IN` | `string` | Time duration string | `15m` | Optional | Lifetime of access tokens before re-authentication is required. |
| `JWT_REFRESH_SECRET` | `string` | Min 32 characters | None | **Yes (>=32 chars)** | Cryptographic secret for signing long-lived (7d) refresh tokens. |
| `JWT_REFRESH_EXPIRES_IN`| `string` | Time duration string | `7d` | Optional | Lifetime of refresh tokens. |
| `JWT_ISSUER` | `string` | Identifier string | `ar-dine-api` | Optional | JWT `iss` claim verification tag. |
| `STORAGE_DIR` | `string` | Filesystem path | `./storage` | Optional | Target directory for local media storage provider. |
| `CLOUDINARY_CLOUD_NAME` | `string` | Alphanumeric | None | Optional | Cloudinary cloud identifier (when cloud delivery enabled). |
| `CLOUDINARY_API_KEY` | `string` | Numeric string | None | Optional | Cloudinary API Key. |
| `CLOUDINARY_API_SECRET` | `string` | Alphanumeric secret | None | Optional | Cloudinary API Secret. |

---

## 3. Frontend Environment Variables Reference

| Variable Name | Type | Format | Default | Required in Production | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | `string` | Canonical API URL with `/api/v1` | `http://localhost:4000/api/v1` | **Yes** | Public endpoint targeting NestJS API gateway. |

---

## 4. Production Secret Generation & Management

### 4.1 Generating Strong Cryptographic Secrets
Never use human-typed phrases or dictionary words. Use OpenSSL:
```bash
# Generate high-entropy 32-byte Base64 secret for JWT_ACCESS_SECRET
openssl rand -base64 32

# Generate high-entropy 32-byte Base64 secret for JWT_REFRESH_SECRET
openssl rand -base64 32
```

### 4.2 Hosting Provider Secret Configuration

#### AWS Systems Manager Parameter Store / Secrets Manager
Store variables as `SecureString`:
- `/ardine/production/jwt_access_secret`
- `/ardine/production/jwt_refresh_secret`
- `/ardine/production/mongodb_uri`

#### Render.com / Railway.app
Configure via **Dashboard → Environment Variables**:
- Ensure all values are marked as secret/encrypted.
- Set `NODE_ENV=production`.

#### Docker Secrets / Compose
In production Docker Swarm or Kubernetes, mount secrets as external files and ingest via container entrypoint scripts.
