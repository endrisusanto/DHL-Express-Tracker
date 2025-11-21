# Perubahan Database Persistence

## Ringkasan
Aplikasi DHL Express Tracker sekarang menyimpan data AWB (tracking number) ke database MySQL sehingga data tetap ada setelah halaman direload.

## Perubahan yang Dilakukan

### 1. Database Schema (`public/database.sql`)
- **Ditambahkan kolom `shipment_data`** (JSON) pada tabel `shipments`
- Kolom ini menyimpan seluruh objek shipment termasuk:
  - Data tracking dari DHL API
  - PIC assignments (orang yang ditugaskan)
  - Status collection (apakah sudah diambil)
  - Timestamp collection

### 2. Backend API (`public/api/shipments.php`)
- **POST endpoint diubah** untuk mendukung `INSERT ... ON DUPLICATE KEY UPDATE`
  - Sekarang bisa create dan update shipment dengan satu endpoint
  - Menerima field `shipment_data` yang berisi JSON lengkap
- **GET endpoint** tetap sama, mengembalikan array shipments
- **DELETE endpoint** tetap sama, menghapus berdasarkan tracking_number

### 3. Frontend (`App.tsx`)
- **`loadDataFromDB()`**: Diubah untuk mem-parse `shipment_data` JSON dari database
- **`saveShipmentToDB()`**: Diubah untuk mengirim data dengan format yang benar:
  ```javascript
  {
    tracking_number: "...",
    status: "...",
    origin: "...",
    destination: "...",
    shipment_data: JSON.stringify(fullShipmentObject)
  }
  ```
- **`deleteShipmentFromDB()`**: Diubah untuk menggunakan DELETE method dengan query parameter
- **Activity logs**: Tetap disimpan di local state (akan hilang saat reload)

## Cara Kerja

1. **Saat menambah AWB baru**:
   - Frontend memanggil DHL API untuk mendapatkan data tracking
   - Data disimpan ke state React
   - `saveShipmentToDB()` dipanggil untuk menyimpan ke database
   - Data dikirim ke backend sebagai JSON string di field `shipment_data`

2. **Saat reload halaman**:
   - `loadDataFromDB()` dipanggil saat component mount
   - Backend mengembalikan array shipments dari database
   - Frontend mem-parse `shipment_data` JSON untuk setiap shipment
   - State React di-update dengan data dari database

3. **Saat update (PIC, collection status, dll)**:
   - State React di-update
   - `saveShipmentToDB()` dipanggil dengan data terbaru
   - Backend melakukan UPDATE karena tracking_number sudah ada

## Testing

Untuk memverifikasi bahwa data tersimpan:

```bash
# 1. Tambahkan AWB melalui UI
# 2. Cek database
docker exec -i dhl-tracker-db mysql -u dhl_user -pdhl_pass dhl_tracker -e "SELECT tracking_number, status, JSON_EXTRACT(shipment_data, '$.pic') as pic FROM shipments;"

# 3. Reload halaman - data harus tetap ada
```

## Catatan Penting

- **Volume persistence**: Database menggunakan named volume `db_data` yang tetap ada meskipun container di-restart
- **Activity logs**: Tidak disimpan ke database, hanya ada di local state
- **Data migration**: Jika ada data lama tanpa `shipment_data`, akan muncul error saat load. Solusi: hapus data lama atau migrate manual

## Troubleshooting

### Data hilang setelah reload
1. Cek apakah kolom `shipment_data` ada:
   ```bash
   docker exec -i dhl-tracker-db mysql -u dhl_user -pdhl_pass dhl_tracker -e "DESCRIBE shipments;"
   ```
2. Cek browser console untuk error
3. Cek logs backend:
   ```bash
   docker-compose logs app
   ```

### Error saat save
1. Pastikan backend berjalan: `docker-compose ps`
2. Test API endpoint:
   ```bash
   curl http://localhost:8800/api/shipments.php
   ```
