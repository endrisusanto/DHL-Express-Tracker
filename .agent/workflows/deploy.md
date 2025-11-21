---
description: Deploy aplikasi DHL Express Tracker ke Docker
---

# Deploy ke Docker

Workflow ini akan mendeploy aplikasi DHL Express Tracker menggunakan Docker Compose.

## Prerequisites

- Docker (version 20.10+)
- Docker Compose (version 2.0+)

## Steps

### 1. Stop containers yang sedang berjalan (jika ada)
```bash
docker-compose down
```

### 2. Build dan jalankan containers
// turbo
```bash
docker-compose up -d --build
```

### 3. Tunggu beberapa detik untuk database initialization
```bash
sleep 5
```

### 4. Verifikasi containers berjalan
// turbo
```bash
docker-compose ps
```

### 5. Cek logs untuk memastikan tidak ada error
// turbo
```bash
docker-compose logs --tail=50
```

### 6. Test API endpoint
// turbo
```bash
curl -s http://localhost:8800/api/shipments.php
```

## Akses Aplikasi

- **Frontend**: http://localhost:8800
- **API**: http://localhost:8800/api/shipments.php

## Troubleshooting

Jika ada masalah, cek logs dengan:
```bash
docker-compose logs -f
```

Untuk restart containers:
```bash
docker-compose restart
```

Untuk reset database (hapus semua data):
```bash
docker-compose down -v
docker-compose up -d --build
```
