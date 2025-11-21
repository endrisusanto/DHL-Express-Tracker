# DHL Express Tracker - Docker Deployment Guide

## 🚀 Quick Start

Deploy aplikasi DHL Express Tracker menggunakan Docker di port 8800.

### Prerequisites

- Docker (version 20.10+)
- Docker Compose (version 2.0+)

### Deployment Steps

1. **Clone repository** (jika belum):
   ```bash
   git clone <repository-url>
   cd DHL-Express-Tracker
   ```

2. **Build dan jalankan containers**:
   ```bash
   docker-compose up -d --build
   ```

3. **Akses aplikasi**:
   - Frontend: http://localhost:8800
   - API: http://localhost:8800/api/shipments.php

### Useful Commands

**Lihat logs**:
```bash
docker-compose logs -f
```

**Stop containers**:
```bash
docker-compose down
```

**Stop dan hapus volumes (reset database)**:
```bash
docker-compose down -v
```

**Rebuild containers**:
```bash
docker-compose up -d --build --force-recreate
```

**Akses database**:
```bash
docker exec -it dhl-tracker-db mysql -u dhl_user -pdhl_pass dhl_tracker
```

## 📦 Architecture

Aplikasi ini menggunakan multi-container setup:

- **app**: React frontend (Vite) + PHP-FPM + Nginx
  - Port: 8800 (external) → 80 (internal)
  - Serves static React build
  - Handles PHP API requests

- **db**: MariaDB 10.6
  - Database: dhl_tracker
  - User: dhl_user
  - Password: dhl_pass
  - Persistent storage via Docker volume

## 🔧 Configuration

### Environment Variables

Edit `docker-compose.yml` untuk mengubah konfigurasi:

```yaml
environment:
  - DB_HOST=db
  - DB_NAME=dhl_tracker
  - DB_USER=dhl_user
  - DB_PASSWORD=dhl_pass
```

### Port Configuration

Untuk mengubah port eksternal, edit `docker-compose.yml`:

```yaml
ports:
  - "8800:80"  # Format: <external>:<internal>
```

## 🗄️ Database

Database schema otomatis diimport saat pertama kali container dijalankan dari file `public/database.sql`.

### Tables:
- `shipments`: Data pengiriman utama
- `tracking_events`: Event tracking untuk setiap pengiriman

## 🔍 API Endpoints

### GET /api/shipments.php
Mendapatkan semua shipments atau shipment spesifik.

**Get all shipments**:
```bash
curl http://localhost:8800/api/shipments.php
```

**Get specific shipment**:
```bash
curl http://localhost:8800/api/shipments.php?tracking_number=DHL123456
```

### POST /api/shipments.php
Membuat shipment baru.

```bash
curl -X POST http://localhost:8800/api/shipments.php \
  -H "Content-Type: application/json" \
  -d '{
    "tracking_number": "DHL123456",
    "status": "In Transit",
    "origin": "Jakarta",
    "destination": "Surabaya",
    "estimated_delivery": "2025-11-25"
  }'
```

### PUT /api/shipments.php
Update shipment.

```bash
curl -X PUT http://localhost:8800/api/shipments.php \
  -H "Content-Type: application/json" \
  -d '{
    "tracking_number": "DHL123456",
    "status": "Delivered"
  }'
```

### DELETE /api/shipments.php
Hapus shipment.

```bash
curl -X DELETE "http://localhost:8800/api/shipments.php?tracking_number=DHL123456"
```

## 🐛 Troubleshooting

### Container tidak start
```bash
# Cek logs
docker-compose logs

# Restart containers
docker-compose restart
```

### Database connection error
```bash
# Cek apakah database container sudah running
docker ps

# Restart database
docker-compose restart db

# Tunggu beberapa detik untuk database initialization
```

### Port sudah digunakan
Jika port 8800 sudah digunakan, ubah di `docker-compose.yml`:
```yaml
ports:
  - "8801:80"  # Gunakan port lain
```

## 📝 Development

Untuk development mode tanpa Docker:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run dev server:
   ```bash
   npm run dev
   ```

3. Setup local PHP server dan database sesuai kebutuhan.

## 🔐 Security Notes

**PENTING**: Untuk production deployment:

1. Ubah password database di `docker-compose.yml`
2. Gunakan environment variables yang aman
3. Setup SSL/TLS certificate
4. Implementasi rate limiting
5. Tambahkan authentication untuk API endpoints

## 📄 License

[Your License Here]
