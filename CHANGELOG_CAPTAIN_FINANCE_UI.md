# Changelog: Akses Captain, Laporan Keuangan, UI Modern, Absensi Pegawai

Ringkasan perubahan untuk 4 permintaan terbaru. **Wajib jalankan migration baru
sebelum deploy**, sisanya otomatis lewat deploy Next.js seperti biasa.

## 1. Jalankan migration baru

```
database/migrations/0016_captain_full_access_and_expense_classification.sql
```

Migration ini **idempotent** (aman dijalankan ulang). Jalankan lewat Supabase SQL
Editor atau CLI, sama seperti migration 0001–0015 sebelumnya.

Isinya:
- Captain sekarang bisa menjalankan seluruh rule & role **KASIR** (buka order,
  tambah item, terima pembayaran, kelola meja) — sebelumnya Captain hanya bisa
  Jadwal Shift & Absensi.
- Captain mendapat akses **view (SELECT saja)** yang setara Owner ke: Pegawai,
  Payroll, Biaya Operasional, Profil staff, Audit Log. Captain **tidak bisa
  menulis/mengubah** data ini — hanya SUPER_ADMIN/OWNER yang bisa, ditegakkan
  di level RLS database (bukan cuma di UI).
- Kolom baru `operational_expenses.expense_type` (`operational` /
  `non_operational`) untuk memisahkan biaya di Laporan Laba Rugi.

## 2. Captain — akses aplikasi

- `src/lib/auth.ts`: `requireAdminOrOwner()` sekarang mengizinkan
  `SUPER_ADMIN`, `OWNER`, dan `CAPTAIN` masuk ke halaman admin (baca data).
  Menulis data tetap dibatasi RLS ke SUPER_ADMIN/OWNER, jadi aman meski Captain
  membuka halaman yang sama.
- `AdminNav.tsx`: Captain sekarang melihat menu yang sama dengan Owner
  (Dashboard, Laporan, Kelola Menu, Pegawai, Absensi, Payroll, Jadwal Kerja, QR
  Meja) plus tombol pintasan **"Buka Kasir"** ke `/pos`.
- Menu **Kelola User** & **Pengaturan** tetap khusus SUPER_ADMIN (tidak berubah,
  Owner pun tidak melihatnya).

## 3. Laporan Laba Rugi (Laporan Keuangan)

- `src/services/reportService.ts` — fungsi baru `getFinancialStatement()`:
  Pendapatan − Biaya Operasional − Biaya Gaji Pegawai − Biaya Non-Operasional =
  **Laba Bersih**, dengan tahapan Laba Kotor & Laba Operasional di antaranya.
- `src/services/operationalExpenseService.ts` — setiap biaya operasional kini
  punya `expense_type`. Kelola/ubah klasifikasinya di halaman
  **Payroll → Biaya Operasional** (dropdown "Operasional" / "Non-Operasional"
  di tiap baris biaya, dan saat menambah biaya baru).
- Halaman **Laporan** (`/admin/reports`) menampilkan kartu Laba
  Kotor/Operasional/Bersih + tabel rincian, bisa di-export CSV dan dicetak
  terpisah (pilih "Laporan Laba Rugi" di dropdown cetak).
- **Keterbatasan yang perlu diketahui**: belum ada modul HPP/COGS bahan baku,
  jadi "Laba Kotor" saat ini = Pendapatan − Biaya Operasional Non-Gaji (belum
  dikurangi harga pokok bahan). Akan disempurnakan begitu modul Inventory
  dibangun (lihat catatan di `PHASE_FINANCE_HR.md`).

## 4. Halaman Absensi Pegawai (dimodernisasi)

`/admin/attendance` (sudah ada sebelumnya, sekarang dirombak total):
- Navigasi tanggal (prev/next/hari ini + date picker) tanpa reload halaman.
- Kartu ringkasan real-time: Hadir, Terlambat, Ijin, Sakit, Pulang Cepat, Tidak
  Hadir.
- Desain baru: avatar inisial, badge status berwarna, form input per baris
  lebih ringkas.
- Captain tetap **lihat-saja** di halaman ini (pencatatan/perubahan absensi
  tetap wewenang Admin/Owner) — konsisten dengan prinsip "Captain = view akses
  seperti Admin/Owner" untuk data sensitif SDM.

## 5. UI/UX modern (Gen Z, tetap profesional)

- `tailwind.config.js` — warna aksen baru `accent`/`accent-dark` (teal) untuk
  highlight, tanpa mengubah identitas warna coklat-kayu/batik utama.
- `globals.css` — design system baru: `.card-modern`, `.stat-card-modern`,
  `.pill-nav-link`, `.btn-primary-modern`, `.btn-ghost-modern`,
  `.section-title-modern`, animasi masuk halus (`animate-float-in`).
- Diterapkan di: Dashboard admin, Nav admin (jadi pill nav dengan
  gradient), Laporan, Payroll, Absensi Pegawai.
- Halaman lain (Kelola Menu, Pegawai, QR Meja, Kasir, dst) belum disentuh di
  iterasi ini — bisa dilanjutkan bertahap memakai kelas `.card-modern` dkk yang
  sudah tersedia supaya konsisten.

## Verifikasi yang sudah dilakukan

- `npx tsc --noEmit` → **tidak ada error**.
- `npx next build` → kompilasi webpack **berhasil** (gagal hanya di tahap
  "Collecting page data" karena tidak ada `SUPABASE_SERVICE_ROLE_KEY` asli di
  environment sandbox ini — bukan bug kode, akan berhasil normal di environment
  deploy dengan kredensial Supabase yang benar).

## Belum dikerjakan / saran lanjutan

- Modernisasi halaman Kelola Menu, Pegawai, QR Meja, POS, Kitchen/Bar board
  belum disentuh — prioritaskan sesuai kebutuhan.
- Pertimbangkan menambah ikon set (mis. lucide-react) untuk polish visual lebih
  lanjut — sengaja belum ditambahkan di iterasi ini supaya tidak menambah
  dependency baru yang belum sempat diuji penuh.
