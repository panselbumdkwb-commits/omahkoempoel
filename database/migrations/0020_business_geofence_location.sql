-- ============================================================
-- OMAH KOEMPOEL — Migration 0020: Koordinat Lokasi Kedai (Geofencing)
--   Dipakai untuk validasi radius 2 meter saat pegawai absen masuk
--   lewat smartphone pribadi (lihat mobileAttendanceService.ts).
--   Profil Kedai lainnya (alamat, maps, sosial media, tagline) TIDAK
--   butuh kolom baru — disimpan lewat system_settings yang sudah ada
--   (lihat settingsService.ts, key kedai_*).
-- Idempotent: aman dijalankan berkali-kali.
-- ============================================================

alter table business add column if not exists latitude numeric(10,7);
alter table business add column if not exists longitude numeric(10,7);

comment on column business.latitude is
  'Koordinat lokasi Kedai (lintang) — dasar validasi radius 2 meter absen masuk lewat HP pribadi pegawai. Diisi manual oleh Super Admin/Owner di halaman Pengaturan lewat koordinat dari Google Maps (klik-kanan lokasi > salin koordinat).';
comment on column business.longitude is
  'Koordinat lokasi Kedai (bujur) — lihat komentar kolom latitude.';

-- Sebelumnya tabel business hanya punya policy SELECT (migration 0002)
-- — belum ada UPDATE sama sekali, jadi kolom di atas tidak akan bisa
-- diisi lewat halaman Pengaturan tanpa policy ini. Dibatasi SUPER_ADMIN
-- saja, konsisten dengan system_settings_manage.
drop policy if exists business_update_super_admin on business;
create policy business_update_super_admin on business for update
  using (id = fn_current_business_id() and fn_current_role_code() = 'SUPER_ADMIN')
  with check (id = fn_current_business_id() and fn_current_role_code() = 'SUPER_ADMIN');
