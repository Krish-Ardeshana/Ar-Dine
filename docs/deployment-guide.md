# AR-DINE — Production Deployment & Operations Guide

## 1. Overview
This guide provides complete, step-by-step instructions for deploying AR-DINE to production or staging environments. It covers containerized execution with Docker Compose, bare-metal / VPS setups using PM2 and systemd, Nginx reverse proxy configuration, and post-deployment validation.

---

## 2. Prerequisites & System Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| **CPU** | 2 vCPU cores | 4 vCPU cores |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 20 GB SSD | 50 GB NVMe SSD (for persistent 3D models) |
| **OS** | Ubuntu 22.04 / 24.04 LTS or Debian 12 | Ubuntu 24.04 LTS |
| **Node.js** | Node.js 22 LTS or 24 LTS | Node.js 22.x LTS |
| **Database** | MongoDB 7.0+ Replica Set or MongoDB Atlas | MongoDB Atlas M10+ |

---

## 3. Environment Configuration Checklist

Create production `.env` files in `backend/` and `frontend/` based on the provided `.env.example` templates.

### Backend (`backend/.env`)
```bash
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.yourdomain.net/ar_dine?retryWrites=true&w=majority
CORS_ORIGIN=https://ar-dine.yourdomain.com
FRONTEND_BASE_URL=https://ar-dine.yourdomain.com
JWT_ACCESS_SECRET=your_production_jwt_access_secret_min_32_chars
JWT_REFRESH_SECRET=your_production_jwt_refresh_secret_min_32_chars
STORAGE_PROVIDER=local # or 'cloudinary'
STORAGE_DIR=/usr/src/app/storage
# If Cloudinary:
# CLOUDINARY_CLOUD_NAME=your_cloud_name
# CLOUDINARY_API_KEY=your_api_key
# CLOUDINARY_API_SECRET=your_api_secret
```

### Frontend (`frontend/.env.production`)
```bash
NEXT_PUBLIC_API_BASE_URL=https://ar-dine.yourdomain.com/api/v1
```

---

## 4. Option A: Docker Compose Deployment

If a Docker runtime is available:

```bash
# 1. Clone the repository
git clone https://github.com/Krish-Ardeshana/Ar-Dine.git /opt/ar-dine
cd /opt/ar-dine

# 2. Configure environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.production
# Edit secrets in backend/.env

# 3. Build and launch services
docker compose -f docker-compose.yml up -d --build

# 4. Verify running containers and health checks
docker compose ps
docker compose logs -f backend
```

---

## 5. Option B: Native Node.js Deployment (PM2 + Systemd)

For staging or bare-metal Linux servers:

```bash
# 1. Install Node.js LTS and PM2
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
sudo npm install -g pm2

# 2. Build Backend
cd /opt/ar-dine/backend
npm ci
npm run build
pm2 start dist/main.js --name "ardine-backend" --time

# 3. Build Frontend
cd /opt/ar-dine/frontend
npm ci
npm run build
pm2 start npm --name "ardine-frontend" -- start

# 4. Save PM2 configuration to start on system boot
pm2 save
pm2 startup
```

---

## 6. Nginx & SSL Configuration

1. Copy the Nginx configuration:
```bash
sudo cp /opt/ar-dine/deploy/nginx/ar-dine.conf /etc/nginx/sites-available/ar-dine.conf
sudo ln -s /etc/nginx/sites-available/ar-dine.conf /etc/nginx/sites-enabled/
```
2. Replace `ar-dine.yourdomain.com` with your real domain.
3. Obtain TLS certificate via Let's Encrypt:
```bash
sudo certbot --nginx -d ar-dine.yourdomain.com
```
4. Verify and reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. Post-Deployment Verification (Smoke Tests)

Execute the following checks immediately following deployment:

1. **API Health Check:**
   ```bash
   curl -i https://ar-dine.yourdomain.com/api/v1/health
   # Expected: HTTP 200 {"status":"ok", ...}
   ```

2. **Frontend Availability:**
   ```bash
   curl -i https://ar-dine.yourdomain.com/
   # Expected: HTTP 200
   ```

3. **SSE Real-Time Stream (Kitchen Display System):**
   ```bash
   curl -N -H "Accept: text/event-stream" \
     https://ar-dine.yourdomain.com/api/v1/restaurants/6acc393d921301868f7b1234/orders/events
   # Expected: HTTP 200 with text/event-stream headers and open socket
   ```

4. **Security Headers Verification:**
   ```bash
   curl -I https://ar-dine.yourdomain.com/api/v1/health
   # Expected headers:
   # X-Content-Type-Options: nosniff
   # X-Frame-Options: DENY
   # Strict-Transport-Security: max-age=31536000
   ```

---

## 8. Backup & Maintenance

1. **MongoDB Atlas Backups:** Managed continuous cloud snapshots with point-in-time restore (configured in Atlas dashboard).
2. **Local Storage Backups:** Daily rsync of `/opt/ar-dine/backend/storage` to off-site cloud bucket (AWS S3 / GCP Cloud Storage).
3. **Log Rotation:** PM2 log rotation module:
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 50M
   pm2 set pm2-logrotate:retain 7
   ```
