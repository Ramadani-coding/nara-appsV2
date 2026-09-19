# ==========================================
# Multi-Stage Dockerfile for Nara Discord Bot
# ==========================================

# ------------------------------------------
# Tahap 1: Builder (Compile TypeScript)
# ------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Salin package manifest
COPY package*.json ./

# Install seluruh dependencies untuk kompilasi
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

# Salin package manifest
COPY package*.json ./

# Install hanya dependencies production
RUN npm ci --omit=dev && npm cache clean --force

# Salin output kompilasi dari tahap builder
COPY --from=builder /app/dist ./dist

# Berikan izin ke non-root user 'node'
RUN chown -R node:node /app

USER node

EXPOSE 5002

# Healthcheck webhook server internal
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5002/health || exit 1

CMD ["node", "dist/index.js"]
