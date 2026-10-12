# ==============================================================================
# AR-DINE Backend Multi-Stage Production Dockerfile
# ==============================================================================

# --- Stage 1: Build & Dependencies ---
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source and configuration
COPY tsconfig.json nest-cli.json ./
COPY src/ ./src/

# Compile TypeScript to production bundle
RUN npm run build

# Remove development dependencies for a lean production image
RUN npm prune --production

# --- Stage 2: Minimal Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=4000

# Install curl for health check
RUN apk --no-cache add curl

# Create directory for persistent local media uploads and grant node permissions
RUN mkdir -p /usr/src/app/storage && chown -R node:node /usr/src/app

# Copy production artifacts from builder
COPY --chown=node:node --from=builder /usr/src/app/package.json ./
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist

# Run as non-privileged user for enhanced security
USER node

EXPOSE 4000

# Periodic health check against centralized /api/v1/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

# Process responds gracefully to SIGTERM / SIGINT
CMD ["node", "dist/main.js"]
