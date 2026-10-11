# AR-DINE — Authorization Matrix & Tenant Access Control

> **Scope:** Role-Based Access Control (RBAC) & Multi-Tenant Scoping  
> **Status:** Implemented & Verified (Phase 3)

---

## 1. Role Architecture & Separation of Concerns

AR-DINE implements a dual-scope authorization model to ensure strict boundaries between platform administration, restaurant-level operations, and public dining:

### 1.1 Global Roles (`globalRoles: UserRole[]`)
Applied at the user level across the entire application:
- **`SUPER_ADMIN`**: Platform superuser with unrestricted cross-tenant read/write access. Granted exclusively through controlled out-of-band administrative provisioning (e.g. database migration or secure bootstrap script).
- **`CUSTOMER`**: Default role granted to all publicly registered patrons. Permits browsing menus, placing table orders, and inspecting personal order history. Does NOT grant access to any restaurant management or kitchen APIs.

### 1.2 Restaurant Memberships (`memberships: RestaurantMembership[]`)
Scoped strictly to a specific `restaurantId`:
- **`RESTAURANT_ADMIN`**: Manager of the assigned restaurant. Full administrative control over categories, menu dishes, 3D AR models, dining tables, and staff memberships *within their tenant only*.
- **`KITCHEN_STAFF`**: Culinary team. Scoped to the Kitchen Display System (KDS) and updating dish preparation state (`CONFIRMED` → `PREPARING` → `READY`).
- **`WAITER`**: Floor service staff. Scoped to table status tracking and delivery fulfillment (`READY` → `SERVED`).

---

## 2. Granular Permissions Matrix

| Resource / Action | Public / Guest | CUSTOMER | WAITER | KITCHEN_STAFF | RESTAURANT_ADMIN | SUPER_ADMIN |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Health & Readiness** | ✅ Public | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Customer Register & Login** | ✅ Public | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Read Own Profile (`/auth/me`)** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Public Menu / 3D Asset View** | ✅ Public | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Place Table Order** | ❌ | ✅ (Tenant-scoped) | ❌ | ❌ | ❌ | ✅ |
| **View Table Order Status** | ❌ | ✅ (Own order) | ✅ (Tenant-scoped) | ✅ (Tenant-scoped) | ✅ (Tenant-scoped) | ✅ |
| **Update Order: Cooking / Ready** | ❌ | ❌ | ❌ | ✅ (Tenant-scoped) | ✅ (Tenant-scoped) | ✅ |
| **Update Order: Served / Paid** | ❌ | ❌ | ✅ (Tenant-scoped) | ❌ | ✅ (Tenant-scoped) | ✅ |
| **Manage Menu Items & Categories** | ❌ | ❌ | ❌ | ❌ | ✅ (Tenant-scoped) | ✅ |
| **Manage Tables & QR Codes** | ❌ | ❌ | ❌ | ❌ | ✅ (Tenant-scoped) | ✅ |
| **Invite & Assign Staff Memberships** | ❌ | ❌ | ❌ | ❌ | ✅ (Tenant-scoped) | ✅ |
| **Platform Provisioning & Auditing** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 3. Multi-Tenant Guard Enforcement

### 3.1 Tenancy Resolution Mechanism
When an endpoint is decorated with `@RequireRestaurantRole(roles)`:
1. `RolesGuard` verifies that the incoming request is authenticated.
2. If the user possesses the `SUPER_ADMIN` global role, access is automatically granted across all tenants.
3. Otherwise, the guard resolves the target restaurant identifier in the following precedence order:
   - Request parameter: `req.params.restaurantId`
   - Request header: `x-restaurant-id`
   - Request body: `req.body.restaurantId`
4. The guard validates canonical 24-character hexadecimal ObjectId format via `TenantHelper.toObjectId`.
5. The guard inspects `user.memberships` to ensure a matching membership exists where:
   - `membership.restaurantId.toString() === targetRestaurantId`
   - `membership.role` satisfies one of the required roles.
6. **Cross-Tenant Prevention:** If a staff member belongs to Restaurant A and attempts to access Restaurant B's resources, the membership check returns `false`, immediately failing closed with `403 Forbidden`.

---

## 4. Privilege Escalation Defenses

1. **Self-Granting Prevention:** `RegisterDto` strictly excludes role or membership fields. Attempts to pass `globalRoles`, `memberships`, or `isAdmin` in JSON payloads are stripped by `ValidationPipe({ whitelist: true })`.
2. **Membership Provisioning Boundary:** Only authenticated `SUPER_ADMIN` or a verified `RESTAURANT_ADMIN` for that specific restaurant can assign staff memberships via `MembershipService.assignStaffRole`.
3. **Impersonation Rejection:** JWT signatures are validated per request; client claims are checked against live database state on sensitive operations.
