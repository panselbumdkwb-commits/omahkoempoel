-- ============================================================
-- OMAH KOEMPOEL — Migration 0010: Jadwal Kerja Pegawai
-- Tabel jadwal kerja mingguan per pegawai (Senin-Minggu), dipakai
-- untuk fitur "Jadwal Kerja Pegawai" di /admin/schedule.
-- ============================================================

create table if not exists employee_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  employee_id uuid not null references employees(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=Minggu ... 6=Sabtu
  shift_start time,
  shift_end time,
  is_off boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, day_of_week)
);

alter table employee_schedules enable row level security;

-- drop if exists dulu supaya file ini AMAN dijalankan ulang (idempotent) —
-- ini yang menyebabkan error "policy already exists" sebelumnya kalau
-- migrasi ini sempat berjalan sebagian lalu dijalankan lagi dari awal.
drop policy if exists employee_schedules_select on employee_schedules;
drop policy if exists employee_schedules_manage on employee_schedules;

-- Bisa dibaca semua staf yang login (supaya pegawai bisa lihat jadwalnya
-- sendiri, bukan cuma admin) — sama pola aksesnya dengan tabel employees.
create policy employee_schedules_select on employee_schedules
  for select using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE','KITCHEN')
  );

-- Hanya SUPER_ADMIN/OWNER yang boleh menyusun/mengubah jadwal.
create policy employee_schedules_manage on employee_schedules
  for all using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER')
  )
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER')
  );

-- Catatan: updated_at diisi manual dari service layer saat update (pola
-- yang sama dipakai tabel lain di aplikasi ini), bukan lewat trigger DB.
