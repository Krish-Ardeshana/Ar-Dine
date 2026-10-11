# AR-DINE — Development Environment Setup Guide

> **Course:** College Project-I (CEUP301), Semester V  
> **Platform:** Windows 11 (PowerShell) / Cross-Platform

---

## 1. Prerequisites

Verify that the following tools are available on your system:

| Tool | Minimum Version | Verified Version |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.0.0` | `v24.20.0` (LTS) |
| **npm** | `>= 10.0.0` | `11.19.0` |
| **Git** | `>= 2.40.0` | `2.56.0` |

### Environment PATH Setup on Windows
If running in PowerShell and tools are not recognized:
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

If script execution policy blocks `npm.ps1`:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 2. Backend Setup (`/backend`)

The backend is built with NestJS and TypeScript.

### 2.1 Configuration
Copy the sample environment file:
```powershell
cd D:\AR_Dine\backend
Copy-Item .env.example .env
```

### 2.2 Install Dependencies
```powershell
npm install
```

### 2.3 Run in Development Mode
```powershell
npm run start:dev
```
The backend server runs on `http://localhost:4000`.  
Health check endpoint: `http://localhost:4000/api/v1/health`

### 2.4 Testing & Quality Checks
```powershell
# Run unit tests
npm test

# Run end-to-end tests
npm run test:e2e

# Run linter
npm run lint

# Build production bundle
npm run build
```

### 2.5 Deterministic Database Seeding
To populate development fixtures (2 restaurants, staff, categories, 3D dishes, and tables):
```powershell
# Ensure MONGODB_URI is set in backend/.env:
npm run seed
```
*(Strictly blocked when `NODE_ENV=production`)*

---

## 3. Frontend Setup (`/frontend`)

The frontend is built with Next.js (App Router), React, TypeScript, and Tailwind CSS.

### 3.1 Configuration
Copy the sample environment file:
```powershell
cd D:\AR_Dine\frontend
Copy-Item .env.example .env.local
```

### 3.2 Install Dependencies
```powershell
npm install
```

### 3.3 Run in Development Mode
```powershell
npm run dev
```
The frontend application starts on `http://localhost:3000`.

### 3.4 Production Build & Verification
```powershell
# Run linter
npm run lint

# Run production build
npm run build
```

---

## 4. Running Both Services Concurrently

Open two separate PowerShell terminal windows:

- **Terminal 1 (Backend API):**
  ```powershell
  cd D:\AR_Dine\backend
  npm run start:dev
  ```

- **Terminal 2 (Frontend Client):**
  ```powershell
  cd D:\AR_Dine\frontend
  npm run dev
  ```
