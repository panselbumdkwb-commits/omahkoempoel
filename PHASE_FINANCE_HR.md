# PHASE — LAPORAN, PEGAWAI, ABSENSI, PAYROLL

## A. Tujuan Phase
Melengkapi kebutuhan Owner: laporan penjualan periode fleksibel dengan
grafik & export, data pegawai, absensi manual, dan sistem payroll dengan
komponen configurable (termasuk BPJS).

## B. File yang dibuat/diubah
```
database/migrations/0007_employee_attendance_payroll.sql
src/services/employeeService.ts
src/services/payrollService.ts
src/services/reportService.ts
src/app/admin/reports/{page,ReportsClient,actions}.tsx|ts
src/app/admin/employees/{page,EmployeesClient,actions}.tsx|ts
src/app/admin/attendance/{page,AttendanceClient}.tsx
src/app/admin/payroll/{page,PayrollClient,actions}.tsx|ts
src/app/admin/AdminNav.tsx (+ link baru)
package.json (+ recharts)
```

## C. Database migration
Jalankan `0007_employee_attendance_payroll.sql` di Supabase (DEV dulu).
Ini menambah kolom di `employees`, tabel `attendance`, `payroll_components`
(dengan seed 4 komponen default), `payroll_periods`, `payroll_items`.

## D. Cara menjalankan
1. `npm install` (menambah `recharts`).
2. Jalankan migration di atas.
3. Login sebagai Owner/Super Admin:
   - `/admin/reports` — pilih periode (Hari Ini/Minggu Ini/Bulan Ini/Custom),
     lihat grafik tren revenue, breakdown pembayaran, produk
     terlaris/kurang laku. Export CSV atau Print tersedia.
   - `/admin/employees` — tambah jabatan, tambah/edit data pegawai.
   - `/admin/attendance` — catat kehadiran harian manual per pegawai.
   - `/admin/payroll` — atur komponen gaji (aktif/nonaktif/tambah baru),
     jalankan payroll untuk periode tertentu, lihat & print slip gaji.

## E. Cara testing
- **Payroll**: tambah 1 pegawai dengan gaji pokok tertentu → jalankan
  payroll 1 periode → cek slip gaji menghitung BPJS JHT 2% & JP 1%
  (dengan batas) secara otomatis, dan Take Home Pay = Gaji Kotor − Total
  Potongan.
- **Report**: buat beberapa order & bayar → cek di `/admin/reports` apakah
  revenue, breakdown pembayaran, dan produk terlaris cocok dengan data
  transaksi asli.
- **RLS**: coba akses `/admin/payroll` dengan akun Kasir → harus redirect
  ke `/pos` (tidak bisa lihat data gaji sama sekali, konsisten dengan
  Phase 1).

## F. Keterbatasan yang perlu Anda ketahui
- **Laba/Rugi dan Neraca formal BELUM dibangun** — laporan yang ada baru
  sisi **revenue** (penjualan). Untuk Laba/Rugi yang akurat, dibutuhkan
  modul **Expense Management** dan **Cash Management** dulu (biaya bahan,
  listrik, sewa, dll) — ini fase besar berikutnya. Neraca (aset/liabilitas/
  ekuitas) butuh Chart of Accounts aktif + jurnal berjalan, juga menyusul.
- Agregasi laporan saat ini dihitung di JavaScript dari data mentah —
  cukup untuk skala 1 cafe; kalau volume transaksi sangat besar nanti,
  sebaiknya dipindah ke SQL view/RPC.
- Absensi masih pencatatan manual oleh Admin, belum ada perangkat
  fingerprint/lokasi otomatis (sesuai catatan privasi di master prompt).

## G. Security consideration
- Semua data pegawai, absensi, dan payroll dilindungi RLS: hanya
  SUPER_ADMIN/OWNER yang bisa lihat/kelola secara penuh; pegawai (kalau
  sudah punya akun login & terhubung via `profile_id`) hanya bisa lihat
  data dirinya sendiri.
- Formula payroll 100% data-driven lewat `payroll_components` — tidak ada
  angka BPJS/tunjangan yang di-hardcode di kode aplikasi.

## H. Next step
Modul **Expense Management** dan **Cash Management** — supaya Laba/Rugi
dan Neraca bisa dibangun dengan data yang benar-benar lengkap, bukan
laporan sepihak yang menyesatkan.
