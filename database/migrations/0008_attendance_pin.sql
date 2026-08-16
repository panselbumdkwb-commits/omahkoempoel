-- ============================================================
-- OMAH KOEMPOEL — Migration 0008: PIN Absensi Mandiri
-- PIN disimpan sebagai HASH (scrypt + salt per pegawai), bukan
-- plaintext — konsisten dengan prinsip keamanan Bagian 46 master
-- prompt (no hardcoded credentials, secure by design).
-- ============================================================

alter table employees add column if not exists attendance_pin_hash text;
