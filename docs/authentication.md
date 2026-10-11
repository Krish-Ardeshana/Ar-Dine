# AR-DINE — Authentication Architecture & API Specification

> **Module:** Identity & Session Management  
> **Status:** Implemented & Verified (Phase 3)  
> **API Base:** `/api/v1/auth`

---

## 1. Architectural Overview

AR-DINE implements a dual-token, defense-in-depth authentication system designed for multi-tenant SaaS security:

1. **Short-Lived Access Token (JWT):**
   - Cryptographically signed with HMAC-SHA256 (`JWT_ACCESS_SECRET`).
   - Default lifetime: 15 minutes (`15m`).
   - Contains minimal non-sensitive identity claims: `sub` (User ObjectId), `email`, and `globalRoles`.
   - Never embeds password hashes, customer personal details, or full restaurant membership collections.

2. **Secure Refresh Token (Stateful Session Invalidation):**
   - cryptographically generated random UUID token passed to the client.
   - **Zero-Plaintext Storage:** Only the one-way cryptographic hash (SHA-256) of the refresh token is persisted in MongoDB (`refreshTokenHash`). If the database is compromised, active session refresh tokens cannot be forged.
   - **Strict Rotation & Revocation:** Every refresh token exchange issues a new token pair and rotates the hashed database token.
   - **Honest Invalidation on Logout:** Calling `POST /api/v1/auth/logout` unsets `refreshTokenHash` in MongoDB, preventing subsequent token refresh cycles.

3. **Password Security:**
   - Salted and hashed using `bcryptjs` with work factor / cost `12`.
   - Passwords must meet strict complexity rules (minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special symbol).
   - `passwordHash` is configured with `select: false` on the Mongoose User schema, ensuring accidental query leaks are impossible.

4. **Global Fail-Closed Guard:**
   - `JwtAuthGuard` is registered globally via `APP_GUARD`.
   - Every route in the application requires a valid JWT unless explicitly decorated with `@Public()`.

---

## 2. API Endpoints Contract

### 2.1 Public Customer Registration

- **Route:** `POST /api/v1/auth/register`
- **Authentication:** None (`@Public()`)
- **Rate Limiting:** Global Throttle Guard
- **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "password": "StrongPassword!123"
  }
  ```
- **Validation Rules:**
  - `name`: String, 2 to 100 characters, trimmed.
  - `email`: Normalized to lowercase, trimmed, validated standard email format.
  - `password`: String, 8 to 128 characters, matching `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$`.
  - **Strict Security Constraint:** Client cannot pass `globalRoles`, `memberships`, or `passwordHash`. Any attempt is rejected or sanitized. Public registration grants strictly `CUSTOMER` role.
- **Success Response (201 Created):**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "4a71d87c-17f1-4df6-8802-b5e17ba93412",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "6640a1b2c3d4e5f6a7b8c9d0",
      "name": "Jane Doe",
      "email": "jane.doe@example.com",
      "globalRoles": ["CUSTOMER"],
      "memberships": []
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Validation failure (weak password, invalid email format).
  - `409 Conflict`: Normalized email address already registered.

---

### 2.2 User Login

- **Route:** `POST /api/v1/auth/login`
- **Authentication:** None (`@Public()`)
- **Request Body:**
  ```json
  {
    "email": "jane.doe@example.com",
    "password": "StrongPassword!123"
  }
  ```
- **Security Features:**
  - **Enumeration Resistance:** Returns identical `401 Unauthorized` ("Invalid email or password") regardless of whether the email was found or the password was incorrect.
  - **Account Status Guard:** Explicitly checks `accountStatus === 'ACTIVE'`. Inactive or suspended accounts receive `403 Forbidden` ("Account has been suspended or deactivated").
- **Success Response (200 OK):**
  Returns identical shape as registration: `accessToken`, `refreshToken`, `tokenType`, `expiresIn`, and safe `user` profile DTO.

---

### 2.3 Token Refresh

- **Route:** `POST /api/v1/auth/refresh`
- **Authentication:** None (`@Public()`)
- **Request Body:**
  ```json
  {
    "refreshToken": "4a71d87c-17f1-4df6-8802-b5e17ba93412"
  }
  ```
- **Behavior:**
  - Computes SHA-256 hash of incoming refresh token.
  - Looks up user with matching `refreshTokenHash` and active status.
  - Rotates both the access token and the refresh token.
  - Returns fresh `accessToken`, `refreshToken`, `expiresIn`, and `user` profile.
- **Error Responses:**
  - `401 Unauthorized`: Token expired, revoked, or invalid.

---

### 2.4 User Logout

- **Route:** `POST /api/v1/auth/logout`
- **Authentication:** Protected (`JwtAuthGuard`)
- **Headers:** `Authorization: Bearer <accessToken>`
- **Behavior:**
  - Clears `refreshTokenHash` in MongoDB for the authenticated user.
  - Prevents subsequent refresh attempts.
- **Success Response (200 OK):**
  ```json
  {
    "message": "Successfully logged out. Active refresh session invalidated."
  }
  ```

---

### 2.5 Authenticated Profile & Session Context

- **Route:** `GET /api/v1/auth/me`
- **Authentication:** Protected (`JwtAuthGuard`)
- **Headers:** `Authorization: Bearer <accessToken>`
- **Behavior:**
  - Fetches the verified user profile from the database using token subject (`sub`).
  - Serializes safe user profile containing only active tenant memberships and permitted roles.
  - Never leaks `passwordHash` or `refreshTokenHash`.
- **Success Response (200 OK):**
  ```json
  {
    "id": "6640a1b2c3d4e5f6a7b8c9d0",
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "globalRoles": ["CUSTOMER"],
    "memberships": []
  }
  ```
