-- ============================================================
-- OMAH KOEMPOEL — Patch 0001c: audit_logs.business_id nullable
-- Masalah: beberapa tabel yang diaudit (mis. role_permissions,
-- permissions) tidak punya kolom business_id sendiri — konteksnya
-- global atau diturunkan lewat relasi, bukan kolom langsung.
-- Trigger menghasilkan business_id = null untuk tabel semacam itu,
-- sehingga NOT NULL constraint di audit_logs menolaknya.
-- Perbaikan: business_id di audit_logs boleh null; log dengan
-- business_id null hanya bisa dibaca SUPER_ADMIN.
-- ============================================================

alter table audit_logs alter column business_id drop not null;

drop policy if exists audit_logs_select on audit_logs;

create policy audit_logs_select on audit_logs
  for select using (
    fn_current_role_code() = 'SUPER_ADMIN'
    or (
      business_id = fn_current_business_id()
      and fn_current_role_code() = 'OWNER'
    )
  );
