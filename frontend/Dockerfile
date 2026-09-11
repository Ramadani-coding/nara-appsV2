# ==========================================
# Multi-Stage Dockerfile for Nara Frontend
# ==========================================

# ------------------------------------------
# Tahap 1: Builder (Compile React + Vite)
# ------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments untuk konfigurasi Vite di build-time
# Default VITE_API_URL=/api agar otomatis di-proxy oleh Nginx tanpa kendala CORS
ARG VITE_API_URL=/api
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Salin package manifest
COPY package*.json ./

# Install seluruh dependencies untuk proses build
RUN npm ci

# Salin source code dan file konfigurasi Vite / Tailwind
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY public ./public
COPY src ./src

# Jalankan build Vite ke folder dist/
RUN npm run build

# ------------------------------------------
# Tahap 2: Web Server Nginx Ringan
# ------------------------------------------
FROM nginx:alpine AS runner

# Hapus konfigurasi dan file default bawaan Nginx
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Salin hasil build Vite dari tahap builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Salin konfigurasi custom Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port HTTP
EXPOSE 80

# Healthcheck memastikan Nginx melayani request dengan baik
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Jalankan Nginx di foreground
CMD ["nginx", "-g", "daemon off;"]
