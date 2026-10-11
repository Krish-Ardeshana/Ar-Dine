# AR-DINE — System Architecture & Request Flow

> **Course:** College Project-I (CEUP301), Semester V  
> **Component:** System Architecture Specification (Phase 1 Baseline)

---

## 1. Architectural Overview

AR-DINE follows a decoupled, multi-tenant client-server architecture designed for high maintainability, independent scalability, and strict security isolation.

```text
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│                                                             │
│   ┌───────────────────────────┐ ┌─────────────────────────┐ │
│   │ Customer Mobile Web (PWA) │ │ Restaurant Admin Portal │ │
│   │  - QR Scan & Menu Browser │ │  - Staff & Menu Mgt     │ │
│   │  - 3D/AR (<model-viewer>) │ │  - Live KDS & Orders    │ │
│   └─────────────┬─────────────┘ └────────────┬────────────┘ │
│                 │                            │              │
│                 └──────────────┬─────────────┘              │
└────────────────────────────────┼────────────────────────────┘
                                 │ HTTPS / REST (JSON)
                                 │ Base URL: /api/v1
┌────────────────────────────────▼────────────────────────────┐
│                    NestJS Backend Layer                     │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Global Middleware / Interceptors / Validation Pipes │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │                              │
│   ┌──────────────────────────▼──────────────────────────┐   │
│   │ Tenant Isolation & RBAC Guards                      │   │
│   │ (Tenant context resolved from JWT, never params)    │   │
│   └──────────┬───────────────────────────────┬──────────┘   │
│              │                               │              │
│   ┌──────────▼──────────┐         ┌──────────▼──────────┐   │
│   │ Menu & Dish Service │         │ Order State Machine │   │
│   │ (Price Validation)  │         │ (Server-side Total) │   │
│   └──────────┬──────────┘         └──────────┬──────────┘   │
│              │                               │              │
│   ┌──────────▼───────────────────────────────▼──────────┐   │
│   │ Data Access Layer (Mongoose ODM)                    │   │
│   └──────────────────────────┬──────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Persistence & Cloud                      │
│                                                             │
│   ┌───────────────────────┐     ┌───────────────────────┐   │
│   │ MongoDB Atlas         │     │ Cloud Object Storage  │   │
│   │ (Multi-Tenant Data)   │     │ (GLB Models & Images) │   │
│   └───────────────────────┘     └───────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Principles

### 2.1 Multi-Tenant Isolation
- Every business entity (Category, MenuItem, Table, Order, Staff) belongs to a specific `restaurantId`.
- **Zero Trust Client Input:** The backend never trusts client-supplied query parameters or body payloads for tenant identity. The active tenant is extracted exclusively from validated authentication tokens (JWT payload) or verified table session tokens.

### 2.2 Server-Authoritative Computations
- All item prices, taxes, discounts, and order totals are calculated exclusively on the backend using trusted database values.
- Client applications transmit item IDs and quantities only. Client-supplied price values are ignored.

### 2.3 Order Lifecycle State Machine
Orders transition strictly through predefined states:
$$\text{PLACED} \longrightarrow \text{CONFIRMED} \longrightarrow \text{PREPARING} \longrightarrow \text{READY} \longrightarrow \text{SERVED} \longrightarrow \text{PAID}$$
Invalid transitions (e.g. `PLACED` $\rightarrow$ `SERVED`) are rejected with explicit HTTP 400 Bad Request responses.

---

## 3. Communication Protocol & Standards

- **API Versioning:** All endpoints are versioned under `/api/v1`.
- **Data Serialization:** Standardized JSON with camelCase property naming.
- **Centralized Error Responses:**
  ```json
  {
    "statusCode": 400,
    "timestamp": "2026-10-12T01:45:00.000Z",
    "path": "/api/v1/orders",
    "message": "Validation failed",
    "errors": [
      {
        "field": "items[0].quantity",
        "error": "quantity must be greater than 0"
      }
    ]
  }
  ```
- **Health Verification:** `GET /api/v1/health` provides operational status, uptime, and component readiness without requiring external database dependencies during boot.
