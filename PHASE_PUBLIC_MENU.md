# PHASE — DIGITAL MENU (Public, Touchscreen-Ready)

## A. Tujuan Phase
Menyediakan halaman utama (`/`) sebagai digital menu publik bernuansa kayu
jati & batik khas Jawa, dioptimalkan untuk layar sentuh, agar konsumen bisa
memilih menu dan membuat order **tanpa login**.

## B. File yang dibuat/diubah
```
src/app/page.tsx        (diganti total — dulu placeholder status koneksi)
src/app/MenuClient.tsx  (baru)
src/app/actions.ts      (baru)
src/components/BatikDivider.tsx (baru)
src/services/publicOrderService.ts (baru)
tailwind.config.js      (+ token warna kayu/batik)
src/app/globals.css     (+ tekstur kayu, font Cinzel & Plus Jakarta Sans)
```

## C. Database migration
Tidak ada migration baru — memakai tabel `orders`, `order_items`,
`order_item_modifiers`, `products`, `tables` yang sudah ada dari Phase 2.

## D. Source code
Alur: **MenuClient (cart di browser) → submitPublicOrderAction → 
publicOrderService (server, service role) → database**. Ini satu-satunya
tempat `supabaseAdmin` dipakai untuk menulis data transaksi — dengan syarat
validasi harga & produk selalu dihitung ulang dari database (lihat komentar
di `publicOrderService.ts`).

## E. Environment variables
Tidak ada tambahan.

## F. Cara menjalankan
1. `npm install`, lalu buka `/` (bukan `/pos`).
2. Pilih kategori, tap produk (kalau ada varian/modifier akan muncul
   pop-up pilihan seperti Es Teh/Nasi Goreng contoh di master prompt).
3. Buka keranjang, pilih Dine In (pilih meja) atau Take Away, tap "Pesan
   Sekarang".
4. Order otomatis masuk ke database dengan status `NEW` — akan terlihat
   nanti di `/pos` untuk diproses kasir (Kitchen Display menyusul di fase
   berikutnya).

## G. Cara testing
- **Harga tidak bisa dimanipulasi**: coba ubah harga produk di response
  jaringan browser sebelum submit → order tetap tercatat dengan harga asli
  dari database, karena `publicOrderService` mengabaikan harga dari client.
- **Meja tidak valid**: pilih order Dine In tanpa memilih meja → harus
  muncul pesan error, order tidak terkirim.
- **Order publik muncul di POS**: setelah submit dari `/`, login sebagai
  kasir di `/pos` → order baru seharusnya nanti terlihat di modul Kitchen
  (Phase berikutnya); untuk sekarang bisa dicek langsung lewat Supabase
  Table Editor pada tabel `orders`.

## H. Expected result
- Halaman `/` menampilkan menu dengan tema kayu/batik, responsif, dan
  nyaman disentuh (tombol besar, kontras baik).
- Order dari konsumen tanpa login tercatat dengan `created_by = null`
  namun tetap lengkap di `audit_logs`.
- Tidak ada satu pun input dari konsumen yang dipercaya mentah-mentah oleh
  server (harga, ketersediaan produk, semua divalidasi ulang).

## I. Security consideration
- Ordering publik memakai `supabaseAdmin` **secara sengaja dan terbatas**,
  hanya di `publicOrderService.ts`, dengan validasi eksplisit di setiap
  langkah — bukan celah RLS terbuka untuk tabel `orders`.
- Kuantitas item dibatasi (1–50) untuk mencegah penyalahgunaan otomatis.
- Tidak ada data sensitif (harga beli, margin, data staf) yang terekspos
  di halaman publik ini.

## J. Next step
Lanjut ke **Phase 3 — Kitchen & Service (KDS)**: order yang masuk dari
`/` dan `/pos` perlu tampil real-time di layar dapur, dan status meja
otomatis berubah mengikuti siklus order.
