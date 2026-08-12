# Omah Koempoel Management System

## Status
Phase 1 — Foundation (database schema, RBAC, RLS, audit trail, Next.js scaffold).

## Menjalankan secara lokal
```bash
npm install
cp .env.example .env.local   # isi dengan kredensial Supabase project dev
npm run dev
```
Buka http://localhost:3000

## Database
Jalankan file di `database/migrations/` secara berurutan lewat Supabase SQL
Editor (project DEV dulu), lalu `database/seed/0001_roles_permissions.sql`.

## Deploy ke Vercel
1. Pastikan `package.json` ada di root repo (bukan di subfolder) — Vercel
   mendeteksi Next.js dari file ini.
2. Isi Environment Variables di Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
3. Redeploy. Halaman utama akan menampilkan status koneksi ke Supabase
   sebagai verifikasi bahwa Phase 1 tersambung end-to-end.

## Struktur
Lihat `PHASE1_FOUNDATION.md` untuk detail lengkap Phase 1.
