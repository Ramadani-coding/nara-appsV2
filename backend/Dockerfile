# ==========================================
# Multi-Stage Dockerfile for Nara Backend
# ==========================================

# ------------------------------------------
# Tahap 1: Builder (Compile TypeScript)
# ------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Salin package manifest
COPY package*.json ./

# Install seluruh dependencies (termasuk devDependencies untuk build tsc)
RUN npm ci

# Salin source code dan konfigurasi TypeScript
COPY tsconfig.json ./
COPY src ./src

# Build project ke JavaScript (dist/)
RUN npm run build

# ------------------------------------------
# Tahap 2: Runner (Production Runtime Ringan)
# ------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001

# Salin package manifest
COPY package*.json ./

# Install hanya dependencies production
RUN npm ci --omit=dev && npm cache clean --force

# Salin output kompilasi dari tahap builder
COPY --from=builder /app/dist ./dist

# Salin folder drizzle SQL migrations jika diperlukan
COPY drizzle ./drizzle

# Berikan izin ke non-root user 'node'
RUN chown -R node:node /app

# Jalankan container menggunakan user non-root untuk keamanan
USER node

# Expose port backend API
EXPOSE 5001

# Healthcheck otomatis untuk memastikan server aktif
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/api/health || exit 1

# Start server
CMD ["node", "dist/index.js"]
