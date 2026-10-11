# AR-DINE — AR Smart Restaurant Management System

> **Course:** College Project-I (CEUP301), Semester V  
> **Repository Status:** Phase 0 Baseline Established — **Application Not Yet Implemented**

---

## 1. Project Overview

**AR-DINE** is a multi-tenant, Augmented Reality (AR) enabled smart restaurant management platform. The system bridges physical dining with digital menus by allowing customers to preview dishes in 3D/AR directly on their tabletop via WebXR-compatible mobile browsers—eliminating guesswork and improving guest satisfaction. For restaurateurs, it offers multi-tenant isolation, real-time kitchen display systems (KDS), waiter dispatch, order life-cycle tracking, and role-based staff management.

---

## 2. Project Objectives & User Roles

### Objectives
- **Interactive AR Dining:** Web-based 3D dish previews (GLB/GLTF via `<model-viewer>`) accessible through table-specific, immutable QR codes without requiring native app installations.
- **Strict Multi-Tenant Isolation:** Multi-restaurant data segregation enforced at the database and API authorization layers.
- **End-to-End Order Workflow:** Fully validated order lifecycle (`PLACED` → `CONFIRMED` → `PREPARING` → `READY` → `SERVED` → `PAID`).
- **Server-Side Integrity:** All totals, taxes, and prices computed strictly by the backend using verified database records.

### Intended User Roles
1. **Super Admin:** Platform owner managing restaurant onboarding, subscriptions, and platform-wide metrics.
2. **Restaurant Admin / Manager:** Manages restaurant profile, staff accounts, tables, categories, menu items, and 3D assets.
3. **Kitchen Staff:** Interacts with the real-time Kitchen Display System (KDS) to update preparation status.
4. **Waiter / Service Staff:** Receives ready-to-serve notifications and updates delivery status at physical tables.
5. **Customer (Guest):** Scans table QR code, browses categorized menu, views dishes in 3D/AR, and places orders.

---

## 3. Planned Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | [Next.js](https://nextjs.org/) (App Router), React, TypeScript, [Tailwind CSS](https://tailwindcss.com/) |
| **3D / AR Rendering** | [`<model-viewer>`](https://modelviewer.dev/), WebXR, GLTF/GLB models |
| **Backend** | [NestJS](https://nestjs.org/) (Modular architecture), TypeScript, REST API |
| **Database** | [MongoDB Atlas](https://www.mongodb.com/atlas) with [Mongoose](https://mongoosejs.com/) |
| **Authentication & AuthZ** | JWT, Argon2/Bcrypt password hashing, Role-Based Access Control (RBAC) |
| **Asset Storage** | Configurable Cloud Object Storage (e.g., Cloudinary / AWS S3) for images and 3D models |
| **Real-Time Layer** | WebSockets (NestJS Gateway) / Server-Sent Events |
| **Caching & Queues** | Redis, BullMQ (optional/future phase) |

---

## 4. Planned Project Structure

```text
AR-DINE/
├── backend/                  # NestJS API application
│   ├── src/
│   │   ├── auth/             # JWT & RBAC module
│   │   ├── tenants/          # Multi-tenant restaurant management
│   │   ├── users/            # User & staff management
│   │   ├── menu/             # Categories, dishes, 3D model metadata
│   │   ├── tables/           # Table QR codes & table management
│   │   ├── orders/           # Order placement & state machine
│   │   ├── common/           # Guards, interceptors, filters, decorators
│   │   └── database/         # Mongoose schemas & connections
│   └── test/                 # Unit and E2E test suites
├── frontend/                 # Next.js customer & admin web application
│   ├── src/
│   │   ├── app/              # App Router pages (customer ordering & admin dashboards)
│   │   ├── components/       # Reusable UI components & AR <model-viewer>
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # API clients & utilities
│   │   └── types/            # Shared TypeScript contracts
│   └── public/               # Static assets & 3D fallback models
├── docs/                     # Architecture diagrams, API specs, and phase deliverables
├── .gitignore                # Root monorepo exclusion rules
└── README.md                 # Project baseline documentation
```

---

## 5. Prerequisites & Environment Setup

### Prerequisites
- **Node.js:** LTS release (v20+ or v24+ recommended)
- **Package Manager:** `npm` (v10+) or `pnpm`
- **Git:** Version 2.40+
- **MongoDB:** MongoDB Atlas account or local MongoDB Community instance
- **Modern Web Browser:** Chrome, Safari, or Edge on Android/iOS with ARCore/ARKit support for WebXR previews

### Quick Start

1. **Start Backend Server:**
   ```powershell
   cd backend
   npm install
   npm run start:dev
   ```
   API runs on `http://localhost:4000/api/v1` (Health: `http://localhost:4000/api/v1/health`).

2. **Start Frontend Client:**
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
   Web interface runs on `http://localhost:3000`.

For detailed setup, see [docs/development-setup.md](file:///d:/AR_Dine/docs/development-setup.md), [docs/architecture.md](file:///d:/AR_Dine/docs/architecture.md), and [docs/database-design.md](file:///d:/AR_Dine/docs/database-design.md).

### Security Note
> ⚠️ **CRITICAL SECURITY REQUIREMENT:**  
> Never commit `.env` files, JWT secrets, database connection strings, or cloud storage API credentials to version control. All sensitive keys must be configured via environment variables and documented solely in `.env.example` templates.

---

## 6. Implementation Status

- [x] **Phase 0:** Toolchain Setup & Repository Baseline
- [x] **Phase 1:** Monorepo Scaffolding & Configuration (NestJS Backend + Next.js Frontend)
- [x] **Phase 2:** Database Schemas & Multi-Tenant Core (MongoDB Atlas + Mongoose)
- [x] **Phase 3:** Authentication & Role-Based Access Control (JWT + RBAC + Multi-Tenant Guards)
- [x] **Phase 4:** Menu Management & 3D/AR Asset Integration (Google model-viewer + WebXR Pipeline)
- [ ] **Phase 5:** Table QR & Customer Ordering Flow
- [ ] **Phase 6:** Order Lifecycle State Machine & Real-Time Sync
- [ ] **Phase 7:** Testing, Security Hardening & Production Verification
