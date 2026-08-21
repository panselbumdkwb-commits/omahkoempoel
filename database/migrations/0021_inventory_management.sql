-- ============================================================
-- OMAH KOEMPOEL — Migration 0021: Manajemen Persediaan (Inventory)
--   Bahan baku, peralatan & perlengkapan. Notifikasi otomatis saat
--   stok mencapai/turun di bawah ambang batas (default 10% dari stok
--   normal/par per item, bisa diubah per item).
-- Idempotent: aman dijalankan berkali-kali.
-- ============================================================

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  category text not null check (category in ('bahan_baku', 'peralatan', 'perlengkapan')),
  name text not null,
  unit text not null default 'pcs',
  current_stock numeric(14,2) not null default 0,
  par_stock numeric(14,2) not null default 0 check (par_stock >= 0),
  alert_threshold_percent numeric(5,2) not null default 10 check (alert_threshold_percent > 0 and alert_threshold_percent <= 100),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, category, name)
);

comment on table inventory_items is
  'Master item persediaan: bahan baku, peralatan, perlengkapan. par_stock = stok normal/ideal acuan; alert_threshold_percent = persentase par_stock yang jadi batas notifikasi stok menipis (default 10%).';
comment on column inventory_items.current_stock is
  'Stok saat ini — HANYA diubah lewat trigger dari inventory_stock_movements (bagian B), jangan update langsung supaya jejak mutasi selalu akurat.';

create index if not exists idx_inventory_items_category on inventory_items (business_id, category);

alter table inventory_items enable row level security;

drop policy if exists inventory_items_select on inventory_items;
create policy inventory_items_select on inventory_items for select
  using (business_id = fn_current_business_id() and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN'));

drop policy if exists inventory_items_manage on inventory_items;
create policy inventory_items_manage on inventory_items for insert
  with check (business_id = fn_current_business_id() and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN'));

drop policy if exists inventory_items_update on inventory_items;
create policy inventory_items_update on inventory_items for update
  using (business_id = fn_current_business_id() and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN'))
  with check (business_id = fn_current_business_id() and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN'));

-- Hapus item HANYA SUPER_ADMIN/OWNER — Captain bisa nonaktifkan
-- (is_active=false) lewat update di atas, tidak bisa hapus permanen.
drop policy if exists inventory_items_delete on inventory_items;
create policy inventory_items_delete on inventory_items for delete
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

drop trigger if exists trg_audit_inventory_items on inventory_items;
create trigger trg_audit_inventory_items after insert or update or delete on inventory_items
  for each row execute function fn_audit_trigger();

-- ----------------------------------------------------------
-- B. MUTASI STOK — ledger append-only (masuk/keluar/penyesuaian).
--    current_stock di inventory_items otomatis ter-update lewat
--    trigger, supaya tidak ada dua sumber kebenaran (single source
--    of truth = ledger ini) dan riwayat selalu akuntabel & bisa diaudit.
-- ----------------------------------------------------------
create table if not exists inventory_stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  inventory_item_id uuid not null references inventory_items(id),
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment')),
  quantity numeric(14,2) not null, -- signed delta: 'in' positif, 'out' negatif, 'adjustment' bebas (+/-)
  related_purchase_id uuid references raw_material_purchases(id),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

comment on table inventory_stock_movements is
  'Ledger mutasi stok (append-only). quantity selalu signed delta terhadap current_stock. related_purchase_id opsional untuk menautkan stok masuk ke catatan belanja di raw_material_purchases.';

create index if not exists idx_inventory_stock_movements_item on inventory_stock_movements (inventory_item_id, created_at desc);

alter table inventory_stock_movements enable row level security;

drop policy if exists inventory_stock_movements_select on inventory_stock_movements;
create policy inventory_stock_movements_select on inventory_stock_movements for select
  using (business_id = fn_current_business_id() and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN'));

-- Ledger append-only: hanya insert, tidak ada update/delete lewat app
-- (koreksi salah catat dilakukan dengan menambah mutasi 'adjustment'
-- baru, bukan mengubah riwayat lama — konsisten dengan audit_logs).
drop policy if exists inventory_stock_movements_insert on inventory_stock_movements;
create policy inventory_stock_movements_insert on inventory_stock_movements for insert
  with check (business_id = fn_current_business_id() and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN'));

create or replace function fn_apply_inventory_stock_movement()
returns trigger language plpgsql as $$
begin
  update inventory_items
    set current_stock = current_stock + NEW.quantity,
        updated_at = now()
    where id = NEW.inventory_item_id;
  return NEW;
end;
$$;

drop trigger if exists trg_apply_inventory_stock_movement on inventory_stock_movements;
create trigger trg_apply_inventory_stock_movement
  after insert on inventory_stock_movements
  for each row execute function fn_apply_inventory_stock_movement();

drop trigger if exists trg_audit_inventory_stock_movements on inventory_stock_movements;
create trigger trg_audit_inventory_stock_movements after insert on inventory_stock_movements
  for each row execute function fn_audit_trigger();
