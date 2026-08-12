-- ============================================================
-- OMAH KOEMPOEL — Seed: Roles & Permissions
-- Run on DEV first. Review before applying to PROD.
-- ============================================================

do $$
declare
  v_business_id uuid;
begin
  select id into v_business_id from business where name = 'Omah Koempoel' limit 1;

  insert into roles (business_id, code, name, description) values
    (v_business_id, 'SUPER_ADMIN', 'Super Admin', 'Akses penuh seluruh sistem'),
    (v_business_id, 'OWNER', 'Owner / Management', 'Akses dashboard, finance, tax, employee, payroll, reports'),
    (v_business_id, 'KASIR', 'Kasir', 'Akses POS, order, payment, shift, receipt'),
    (v_business_id, 'FRONT_SERVE', 'Front Serve', 'Akses table, reservation, order, service status')
  on conflict (business_id, code) do nothing;
end $$;

insert into permissions (code, module, description) values
  ('order.create', 'order', 'Membuat order baru'),
  ('order.view', 'order', 'Melihat order'),
  ('order.void', 'order', 'Membatalkan order'),
  ('payment.process', 'payment', 'Memproses pembayaran'),
  ('table.manage', 'table', 'Mengelola status meja'),
  ('reservation.manage', 'reservation', 'Mengelola reservasi'),
  ('finance.view', 'finance', 'Melihat laporan keuangan'),
  ('finance.manage', 'finance', 'Mengelola expense, cash, reconciliation'),
  ('payroll.view', 'payroll', 'Melihat payroll'),
  ('payroll.manage', 'payroll', 'Mengelola & approve payroll'),
  ('employee.view', 'employee', 'Melihat data karyawan'),
  ('employee.manage', 'employee', 'Mengelola data karyawan'),
  ('user.manage', 'user', 'Mengelola user, role, permission'),
  ('audit.view', 'audit', 'Melihat audit log'),
  ('settings.manage', 'settings', 'Mengelola konfigurasi sistem')
on conflict (code) do nothing;

-- Map permissions to roles
do $$
declare
  r_super uuid; r_owner uuid; r_kasir uuid; r_front uuid;
begin
  select id into r_super from roles where code = 'SUPER_ADMIN';
  select id into r_owner from roles where code = 'OWNER';
  select id into r_kasir from roles where code = 'KASIR';
  select id into r_front from roles where code = 'FRONT_SERVE';

  -- SUPER_ADMIN: everything
  insert into role_permissions (role_id, permission_id)
  select r_super, id from permissions
  on conflict do nothing;

  -- OWNER: everything except user.manage
  insert into role_permissions (role_id, permission_id)
  select r_owner, id from permissions where code <> 'user.manage'
  on conflict do nothing;

  -- KASIR
  insert into role_permissions (role_id, permission_id)
  select r_kasir, id from permissions
  where code in ('order.create','order.view','payment.process','table.manage')
  on conflict do nothing;

  -- FRONT_SERVE
  insert into role_permissions (role_id, permission_id)
  select r_front, id from permissions
  where code in ('order.create','order.view','table.manage','reservation.manage')
  on conflict do nothing;
end $$;
