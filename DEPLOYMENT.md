# 🚀 Panduan Deployment Nara Store ke VPS Menggunakan Docker & Docker Compose

Panduan lengkap ini menjelaskan langkah demi langkah untuk menaikkan website **Nara Digital Store** ke server VPS (Virtual Private Server) berbasis Linux (Ubuntu / Debian) dengan arsitektur container Docker.

---

## 📋 Daftar Isi
1. [Spesifikasi Server & Prasyarat](#1-spesifikasi-server--prasyarat)
2. [Instalasi Docker & Docker Compose di VPS](#2-instalasi-docker--docker-compose-di-vps)
3. [Menyiapkan Project di VPS](#3-menyiapkan-project-di-vps)
4. [Konfigurasi Environment Variables (.env)](#4-konfigurasi-environment-variables-env)
5. [Menjalankan Aplikasi (Build & Run)](#5-menjalankan-aplikasi-build--run)
6. [Migrasi & Seeding Database](#6-migrasi--seeding-database)
7. [Konfigurasi Domain & SSL / HTTPS](#7-konfigurasi-domain--ssl--https)
8. [Konfigurasi Webhook Midtrans Production](#8-konfigurasi-webhook-midtrans-production)
9. [Perintah Operasional & Maintenance Harian](#9-perintah-operasional--maintenance-harian)

---

## 1. Spesifikasi Server & Prasyarat

- **Sistem Operasi**: Ubuntu 22.04 LTS atau Ubuntu 24.04 LTS (Direkomendasikan) / Debian 11/12.
- **Spesifikasi Minimal VPS**:
  - **RAM**: Minimal 1 GB (Sangat disarankan mengaktifkan Swap 2 GB jika RAM 1 GB).
  - **CPU**: 1 Core vCPU.
  - **Storage**: 15–20 GB SSD.
- **Port yang Perlu Dibuka di Firewall VPS**:
  - `80` (HTTP)
  - `443` (HTTPS)
  - `22` (SSH)

> 💡 **Tips Menambah SWAP 2GB (Wajib untuk VPS RAM 1GB agar proses build lancar):**
> ```bash
> sudo fallocate -l 2G /swapfile
> sudo chmod 600 /swapfile
> sudo mkswap /swapfile
> sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

---

## 2. Instalasi Docker & Docker Compose di VPS

Masuk ke VPS via SSH, lalu jalankan script instalasi resmi Docker:

```bash
# Update paket sistem
sudo apt update && sudo apt upgrade -y

# Install git, curl, dan ufw
sudo apt install -y curl git ufw

# Install Docker Engine otomatis
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Tambahkan user aktif ke grup docker agar tidak perlu sudo setiap kali
sudo usermod -aG docker $USER

# Aktifkan service docker
sudo systemctl enable --now docker

# Cek apakah docker dan docker compose sudah terpasang
docker --version
docker compose version
```

---

## 3. Menyiapkan Project di VPS

Clone repository project Anda ke dalam VPS (misalnya di folder `/var/www/nara-store` atau folder home):

```bash
# Pindah ke direktori tujuan
cd /var/www || cd ~

# Clone repository Anda
git clone <URL_REPOSITORY_ANDA> nara-store
cd nara-store
```

---

## 4. Konfigurasi Environment Variables (.env)

Aplikasi membutuhkan konfigurasi environment untuk backend dan docker-compose.

### A. Buat File `.env` di Root (Opsional, untuk Port)
```bash
cp .env.example .env
nano .env
```
Isi default:
```ini
APP_PORT=80
VITE_API_URL=/api
```

### B. Konfigurasi File `backend/.env` (Wajib)
Salin contoh environment backend:
```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Pastikan mengisi variabel berikut sesuai kredensial production Anda:
```ini
PORT=5001
NODE_ENV=production

# 1. Database Supabase PostgreSQL
DATABASE_URL=postgresql://postgres:[PASSWORD_SUPABASE_ANDA]@db.[ID_PROJECT].supabase.co:5432/postgres

# 2. Supabase API
SUPABASE_URL=https://[ID_PROJECT].supabase.co
SUPABASE_ANON_KEY=[ANON_KEY_ANDA]

# 3. Provider Supplier Premiumku API
PREMIUMKU_BASE_URL=https://premku.com/api
PREMIUMKU_API_KEY=[API_KEY_PREMKU_ANDA]
PREMKU_SYNC_INTERVAL_MINUTES=5

# 4. Midtrans Payment Gateway (Mode Production)
MIDTRANS_SERVER_KEY=[SERVER_KEY_PRODUCTION]
MIDTRANS_CLIENT_KEY=[CLIENT_KEY_PRODUCTION]
MIDTRANS_IS_PRODUCTION=true

# 5. Fonnte WhatsApp Notification Gateway (Opsional)
FONNTE_TOKEN=[TOKEN_FONNTE_ANDA]

# 6. Salt Keamanan Token Pesanan (Gunakan string acak 32 karakter unik)
ORDER_SECRET_SALT=kombinasi_acak_rahasia_dan_panjang_32_karakter_minimal

# 7. Frontend Client URL (Domain HTTPS Anda)
FRONTEND_URL=https://domainanda.com
```
*Simpan file dengan menekan `CTRL + O`, `ENTER`, lalu keluar dengan `CTRL + X`.*

### C. Konfigurasi Bot Discord (`bot/.env`)
```bash
cp bot/.env.example bot/.env
nano bot/.env
```
Isi kredensial bot dari [Discord Developer Portal](https://discord.com/developers/applications):
```ini
# Token dan Client ID dari Discord Developer Portal
DISCORD_BOT_TOKEN=token_bot_anda_dari_discord_portal
DISCORD_CLIENT_ID=client_id_aplikasi_anda
DISCORD_GUILD_ID=   # Kosongkan untuk deploy global, atau isi server ID untuk dev instan

# URL Backend API (gunakan service name internal Docker)
BACKEND_URL=http://backend:5001/api
BOT_PORT=5002

STORE_NAME=Nara Digital Store
ADMIN_WHATSAPP_PHONE=085750231336
STORE_WEBSITE_URL=https://domainanda.com
```

> 🤖 **Cara Setup & Invite Bot Discord:**
> 1. Buka [Discord Developer Portal](https://discord.com/developers/applications) lalu pilih **New Application**.
> 2. Di tab **Bot**: Buat token (**Reset Token** / **Copy**) dan aktifkan **Message Content Intent** jika diperlukan.
> 3. Di tab **OAuth2 > URL Generator**:
>    - Centang Scopes: `bot`, `applications.commands`.
>    - Centang Bot Permissions: `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`, `Use Slash Commands`.
> 4. Salin URL invite yang dihasilkan dan buka di browser untuk memasukkan bot ke server Discord Anda.
> 5. Daftarkan Slash Commands (`/produk`, `/pesanan-saya`, `/bantuan`):
>    ```bash
>    # Langsung via container docker di VPS:
>    docker compose exec bot npm run deploy-commands
>    # Atau jika dijalankan lokal/host:
>    cd bot && npm run deploy-commands
>    ```

---

## 5. Menjalankan Aplikasi (Build & Run)

Jalankan perintah berikut di root folder project:

```bash
# Build seluruh image dan jalankan container di background
docker compose up -d --build
```

Docker Compose akan otomatis:
1. Melakukan build container `backend` (compile TypeScript, download dependencies produksi).
2. Melakukan build container `frontend` (compile Vite SPA, setup web server Nginx).
3. Melakukan build container `bot` (service Discord Bot & Delivery Poller).
4. Mengonfigurasi internal network `nara-network`.
5. Mengarahkan traffic port `80` langsung ke Nginx frontend yang merangkap reverse proxy ke backend `/api/*`.

### Cek Status Container:
```bash
docker compose ps
```
Pastikan `nara-backend` berstatus **`healthy`** dan `nara-frontend` berstatus **`running`**.

### Cek Log Container:
```bash
# Log seluruh container
docker compose logs -f

# Log backend saja (melihat output sinkronisasi stok dan transaksi)
docker compose logs -f backend

# Log Nginx frontend
docker compose logs -f frontend
```

---

## 6. Migrasi & Seeding Database

Jika Anda menggunakan database baru atau ingin memastikan seluruh tabel terbuat dengan benar, jalankan migrasi schema Drizzle langsung di dalam container backend:

```bash
# Push schema tabel ke PostgreSQL
docker compose exec backend npm run db:push

# (Opsional) Jalankan fetch awal produk dari Premiumku
docker compose exec backend npm run fetch-products

# (Opsional) Cek saldo akun Premiumku
docker compose exec backend npm run check-saldo
```

---

## 7. Konfigurasi Domain & SSL / HTTPS

Untuk production, website wajib berjalan di protokol **HTTPS** agar pembayaran Midtrans dan browser tidak diblokir.

### 🌟 Metode A: Menggunakan Cloudflare (Sangat Direkomendasikan & Paling Cepat)
1. Hubungkan domain Anda ke Cloudflare.
2. Buat DNS Record:
   - Tipe: `A`
   - Name: `@` (atau subdomain misal `store`)
   - IPv4 Address: `IP_VPS_ANDA`
   - Proxy status: **Proxied (Awan Oranye AKTIF)**
3. Pada tab **SSL/TLS** di Cloudflare:
   - Pilih mode enkripsi: **Full** atau **Flexible**.
4. Selesai! Website Anda langsung memiliki SSL gratis, proteksi DDoS, dan CDN tanpa perlu menginstall certbot di server.

---

### 🛡️ Metode B: Menggunakan Host Nginx + Certbot Let's Encrypt (Jika Tidak Pakai Cloudflare)
Jika Anda ingin SSL Let's Encrypt langsung di VPS:

1. Ubah port Docker di `.env` root agar tidak bentrok dengan Nginx host:
   ```ini
   APP_PORT=8080
   ```
   Lalu restart container:
   ```bash
   docker compose up -d
   ```

2. Install Nginx dan Certbot di OS VPS:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

3. Buat konfigurasi Nginx host:
   ```bash
   sudo nano /etc/nginx/sites-available/nara-store
   ```
   Isi dengan konfigurasi:
   ```nginx
   server {
       server_name domainanda.com www.domainanda.com;

       location / {
           proxy_pass http://127.0.0.1:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

4. Aktifkan situs dan request SSL:
   ```bash
   sudo ln -s /etc/nginx/sites-available/nara-store /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   sudo certbot --nginx -d domainanda.com -d www.domainanda.com
   ```

---

## 8. Konfigurasi Webhook Midtrans Production

Agar status pembayaran pesanan otomatis terupdate saat pelanggan membayar melalui QRIS / GoPay / ShopeePay:

1. Buka dashboard **[Midtrans MAP](https://dashboard.midtrans.com/)** (Pilih Environment: **Production**).
2. Masuk ke menu **Settings** -> **Configuration**.
3. Pada kolom **Payment Notification URL**, isi dengan:
   ```
   https://domainanda.com/api/payments/notification
   ```
4. Klik tombol **Update** / **Simpan**.
5. Pastikan status **Active** tercentang.

---

## 9. Perintah Operasional & Maintenance Harian

Berikut kumpulan perintah penting untuk mengelola aplikasi di VPS:

| Perintah | Fungsi |
| :--- | :--- |
| `docker compose ps` | Melihat status running semua service |
| `docker compose logs -f backend` | Memantau log backend secara live |
| `docker compose logs -f --tail=100` | Melihat 100 log terakhir |
| `docker compose restart` | Merestart semua service |
| `docker compose restart backend` | Merestart backend saja |
| `docker compose stop` | Menghentikan semua service |
| `docker compose start` | Menjalankan kembali service yang terhenti |
| `docker compose down` | Menghapus container dan network |

### Cara Mengupdate Kode Aplikasi ke Versi Terbaru:
Setiap kali Anda melakukan push update kode dari lokal/git ke VPS, cukup jalankan:
```bash
cd /var/www/nara-store
git pull origin main
docker compose up -d --build
```
*Proses ini akan me-rebuild image dan mengganti container lama dengan downtime kurang dari 5 detik.*
