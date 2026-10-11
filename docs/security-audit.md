# AR-DINE — Security Audit & Threat Model

> **Scope:** Identity, Session Management, RBAC & Multi-Tenant Segregation  
> **Phase:** Phase 3 Verification  
> **Date:** October 12, 2026

---

## 1. Threat Modeling & Vulnerability Analysis

### 1.1 Account Enumeration Prevention
- **Threat:** Attackers probing `POST /api/v1/auth/login` to deduce whether target email addresses exist.
- **Defense Implemented:** `AuthService.login` returns an identical `401 Unauthorized` message (`"Invalid email or password"`) regardless of whether the email was not found or the password did not match.
- **Timing Parity:** When a user is not found, a dummy password hash comparison is executed to mitigate timing-based enumeration attacks.

### 1.2 Credential Theft via Database Leakage
- **Threat:** Malicious actor acquires a read-only database dump.
- **Defense Implemented:**
  - Passwords are salt-hashed using `bcryptjs` with cost `12`. Plaintext passwords are never logged or stored.
  - Refresh tokens are hashed using SHA-256 before storage in `refreshTokenHash`. Stolen database snapshots do not allow session hijacking.
  - Both `passwordHash` and `refreshTokenHash` are marked with `select: false` in the Mongoose schema, preventing standard queries from returning them.

### 1.3 Privilege Escalation & Role Forgery
- **Threat:** Users modifying registration payloads to grant themselves `SUPER_ADMIN` or `RESTAURANT_ADMIN`.
- **Defense Implemented:**
  - `RegisterDto` validates only `name`, `email`, and `password`.
  - NestJS `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` strictly discards or rejects unallowed properties.
  - Registration code forces `globalRoles: [UserRole.CUSTOMER]` and empty `memberships: []`.
  - Staff memberships can only be provisioned through authenticated administrative service boundaries.

### 1.4 Cross-Tenant Data Leakage
- **Threat:** A staff member assigned to Restaurant A attempts to inspect or mutate orders/menus belonging to Restaurant B.
- **Defense Implemented:**
  - `RolesGuard` extracts the target restaurant identifier and cross-checks against the user's verified `memberships` array.
  - Access is denied with `403 Forbidden` if the user's membership does not explicitly match the target `restaurantId`.
  - All MongoDB queries downstream utilize `TenantHelper.scopeQuery` ensuring tenant filters are unconditionally applied.

### 1.5 Token Invalidation & Session Revocation
- **Threat:** Compromised or logged-out access tokens continuing to be refreshed.
- **Defense Implemented:**
  - Short token lifetimes: Access tokens expire in 15 minutes.
  - On `POST /api/v1/auth/logout`, `refreshTokenHash` is removed from MongoDB.
  - Any subsequent attempt to use the refresh token is immediately rejected with `401 Unauthorized`.

---

## 2. Client-Side Token Storage & XSS Considerations

In the Next.js client, access tokens and refresh tokens are managed via `authStorage` (`localStorage`).
- **XSS Trade-off Analysis:** While HttpOnly cookies provide immunity against script-based token extraction, bearer tokens in single-page applications allow seamless cross-origin microservice decoupling and mobile/PWA compatibility.
- **Mitigation:**
  - Access token lifetimes are limited to 15 minutes.
  - All user inputs rendered on the frontend are sanitized by React's native JSX escaping.
  - CSP and CORS configurations restrict API communication strictly to configured origins (`CORS_ORIGIN`).
  - Production environments should consider transitioning refresh tokens to `HttpOnly, Secure, SameSite=Strict` cookies once a reverse-proxy (e.g., Nginx or Next.js API route proxy) is deployed in Phase 7.

---

## 3. Automated Security Test Evidence

The following security properties are verified by automated tests in `vitest`:

| Security Property | Test Location | Status |
| :--- | :--- | :---: |
| Password non-plaintext output | `password.service.spec.ts` | ✅ PASS |
| Incorrect password rejection | `password.service.spec.ts` | ✅ PASS |
| Customer-only registration enforcement | `auth.service.spec.ts` | ✅ PASS |
| Duplicate email race condition handling | `auth.service.spec.ts` | ✅ PASS |
| Generic invalid credential error | `auth.service.spec.ts` | ✅ PASS |
| Suspended account blocking | `auth.service.spec.ts` | ✅ PASS |
| Token refresh rotation & reuse denial | `auth.service.spec.ts` | ✅ PASS |
| Public route bypass validation | `jwt-auth.guard.spec.ts` | ✅ PASS |
| Missing token fail-closed enforcement | `jwt-auth.guard.spec.ts` | ✅ PASS |
| Global SUPER_ADMIN bypass verification | `roles.guard.spec.ts` | ✅ PASS |
| Scoped restaurant membership enforcement | `roles.guard.spec.ts` | ✅ PASS |
| Cross-tenant unauthorized access denial | `roles.guard.spec.ts` | ✅ PASS |
| Password hash exclusion from responses | `auth.controller.spec.ts` | ✅ PASS |
| Admin staff assignment boundary | `membership.service.spec.ts` | ✅ PASS |
