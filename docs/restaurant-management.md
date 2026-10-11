# AR-DINE — Restaurant Onboarding & Management

> **Module:** Multi-Tenant Restaurant Administration  
> **Phase:** Implemented & Verified in Phase 4  
> **API Prefix:** `/api/v1/restaurants`

---

## 1. Restaurant Provisioning Architecture

AR-DINE enforces strict administrative boundaries to prevent unauthorized tenant creation or self-promotion:

1. **Restricted Restaurant Creation:**
   - Only platform `SUPER_ADMIN` accounts can provision new restaurant tenants via `POST /api/v1/restaurants`.
   - Public customer registration (`/api/v1/auth/register`) strictly grants `CUSTOMER` role and cannot instantiate a restaurant.

2. **Owner Provisioning & Linkage:**
   - When a `SUPER_ADMIN` provisions a restaurant with an `ownerEmail`:
     - If the user already exists in AR-DINE, the system grants them `RESTAURANT_ADMIN` role for that specific restaurant and links `restaurant.ownerId`.
     - If the user does not yet have an account, the system creates a secure pending `RestaurantInvitation` with role `RESTAURANT_ADMIN`.
   - When the user registers and accepts the invitation token, their verified membership is automatically assigned.

3. **Cryptographic Single-Use Invitation Tokens:**
   - Generated using 32 cryptographically random bytes (`crypto.randomBytes(32).toString('hex')` = 64 hex characters).
   - **Zero-Plaintext Storage:** Only the one-way SHA-256 hash (`tokenHash`) is persisted in MongoDB (`restaurant_invitations` collection).
   - **Enforced Recipient Integrity:** When accepting via `POST /api/v1/restaurants/invitations/accept`, the accepting user's verified session email must match the invitation's recipient email, preventing stolen token exploitation.
   - **Single-Use Revocation:** Upon acceptance, the status changes to `ACCEPTED`, revoking subsequent usage.
   - **Expirations:** Invitations expire 7 days after issuance.

---

## 2. API Endpoints

| Endpoint | Method | Required Role | Description |
| :--- | :---: | :---: | :--- |
| `POST /api/v1/restaurants` | `POST` | `SUPER_ADMIN` | Provisions a new restaurant and assigns an owner. |
| `GET /api/v1/restaurants/me` | `GET` | Authenticated | Lists all restaurants where current user has staff or admin roles. |
| `GET /api/v1/restaurants/:id` | `GET` | Public / Staff | Returns public profile if published; full details for authorized staff. |
| `PATCH /api/v1/restaurants/:id` | `PATCH` | `RESTAURANT_ADMIN` | Updates restaurant info, publication status, and operational hours. |
| `POST /api/v1/restaurants/:id/invitations` | `POST` | `RESTAURANT_ADMIN` | Issues single-use token to invite staff (Admin, Kitchen, Waiter). |
| `POST /api/v1/restaurants/invitations/accept` | `POST` | Authenticated | Validates token hash and grants restaurant membership. |

---

## 3. Publication & Operational States

- **Publication Status (`publicationStatus`):**
  - `DRAFT`: Catalog under development; hidden from customer search and tabletop menus.
  - `PUBLISHED`: Catalog publicly accessible for table ordering.
  - `ARCHIVED`: Restaurant ceased operations.
- **Operational Status (`operationalStatus`):**
  - `OPEN`: Accepting dining orders.
  - `PAUSED`: Temporarily paused (e.g. kitchen overload).
  - `CLOSED`: Outside operating hours.
