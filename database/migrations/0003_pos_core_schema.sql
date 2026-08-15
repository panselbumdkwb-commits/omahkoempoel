-- ============================================================
-- OMAH KOEMPOEL — Migration 0003: POS Core Schema
-- Scope: table management, catalog, orders, payments.
-- Run AFTER 0001, 0001b, 0001c, 0002.
-- ============================================================

-- ----------------------------------------------------------
-- TABLE MANAGEMENT
-- ----------------------------------------------------------
create table if not exists table_areas (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  area_id uuid references table_areas(id),
  number text not null,
  capacity int not null default 2,
  status text not null default 'available'
    check (status in ('available','reserved','occupied','cleaning','maintenance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, number)
);

-- ----------------------------------------------------------
-- CATALOG
-- ----------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  category_id uuid references categories(id),
  sku text not null,
  name text not null,
  description text,
  price numeric(14,2) not null check (price >= 0),
  image_url text,
  status text not null default 'active' check (status in ('active','inactive')),
  prep_time_minutes int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (business_id, sku)
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,             -- e.g. "Large", "Less Sugar"
  price_adjustment numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists product_modifiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,             -- e.g. "Extra Sambal", "Telur"
  price_adjustment numeric(14,2) not null default 0,
  is_required boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------
-- ORDER NUMBERING (per business, per day)
-- ----------------------------------------------------------
create table if not exists order_number_counters (
  business_id uuid not null references business(id),
  order_date date not null,
  last_number int not null default 0,
  primary key (business_id, order_date)
);

create or replace function fn_next_order_number(p_business_id uuid)
returns text
language plpgsql
as $$
declare
  v_next int;
begin
  insert into order_number_counters (business_id, order_date, last_number)
  values (p_business_id, current_date, 1)
  on conflict (business_id, order_date)
  do update set last_number = order_number_counters.last_number + 1
  returning last_number into v_next;

  return 'ORD-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(v_next::text, 4, '0');
end;
$$;

-- ----------------------------------------------------------
-- ORDERS
-- ----------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  order_number text not null,
  order_type text not null check (order_type in ('dine_in','take_away','reservation')),
  table_id uuid references tables(id),
  customer_id uuid,
  status text not null default 'NEW'
    check (status in ('NEW','CONFIRMED','PROCESSING','READY','SERVED','PAID','CLOSED','VOID')),
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  service_charge numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  closed_by uuid references profiles(id),
  closed_at timestamptz,
  unique (business_id, order_number)
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid,   -- auto-filled by trigger from parent order
  order_id uuid not null references orders(id),
  product_id uuid not null references products(id),
  variant_id uuid references product_variants(id),
  quantity int not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  notes text,
  status text not null default 'NEW' check (status in ('NEW','PROCESSING','READY','SERVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  modifier_id uuid references product_modifiers(id),
  name text not null,
  price_adjustment numeric(14,2) not null default 0
);

-- Auto-fill business_id on order_items from parent order
create or replace function fn_set_business_id_from_order()
returns trigger
language plpgsql
as $$
begin
  select business_id into NEW.business_id from orders where id = NEW.order_id;
  return NEW;
end;
$$;

drop trigger if exists trg_order_items_business_id on order_items;
create trigger trg_order_items_business_id
  before insert on order_items
  for each row execute function fn_set_business_id_from_order();

-- ----------------------------------------------------------
-- PAYMENTS
-- ----------------------------------------------------------
create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  code text not null,             -- cash, qris, transfer, edc
  name text not null,
  type text not null check (type in ('cash','qris','bank_transfer','edc')),
  is_active boolean not null default true,
  unique (business_id, code)
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid,   -- auto-filled by trigger from parent order
  order_id uuid not null references orders(id),
  payment_method_id uuid not null references payment_methods(id),
  amount numeric(14,2) not null check (amount > 0),
  reference_no text,
  status text not null default 'COMPLETED' check (status in ('PENDING','COMPLETED','FAILED','REFUNDED')),
  paid_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

drop trigger if exists trg_payments_business_id on payments;
create trigger trg_payments_business_id
  before insert on payments
  for each row execute function fn_set_business_id_from_order();

-- ----------------------------------------------------------
-- DATA INTEGRITY: CLOSED orders & COMPLETED payments are immutable
-- (Master Prompt Bagian 53). Correction must go through a separate
-- void/refund/adjustment mechanism in a later phase, not direct UPDATE.
-- ----------------------------------------------------------
create or replace function fn_block_closed_order_update()
returns trigger
language plpgsql
as $$
begin
  if OLD.status = 'CLOSED' then
    raise exception 'Order % sudah CLOSED dan tidak dapat diubah langsung. Gunakan mekanisme adjustment/void/refund.', OLD.order_number;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_block_closed_order_update on orders;
create trigger trg_block_closed_order_update
  before update on orders
  for each row execute function fn_block_closed_order_update();

create or replace function fn_block_completed_payment_update()
returns trigger
language plpgsql
as $$
begin
  if OLD.status = 'COMPLETED' then
    raise exception 'Payment % sudah COMPLETED dan tidak dapat diubah langsung. Gunakan mekanisme refund.', OLD.id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_block_completed_payment_update on payments;
create trigger trg_block_completed_payment_update
  before update on payments
  for each row execute function fn_block_completed_payment_update();

-- No DELETE policy will be created for orders/order_items/payments in the
-- RLS migration — financial transactions are never hard-deleted.

-- ----------------------------------------------------------
-- AUDIT TRIGGERS for POS core tables
-- ----------------------------------------------------------
drop trigger if exists trg_audit_orders on orders;
create trigger trg_audit_orders after insert or update on orders
  for each row execute function fn_audit_trigger();

drop trigger if exists trg_audit_order_items on order_items;
create trigger trg_audit_order_items after insert or update on order_items
  for each row execute function fn_audit_trigger();

drop trigger if exists trg_audit_payments on payments;
create trigger trg_audit_payments after insert or update on payments
  for each row execute function fn_audit_trigger();

drop trigger if exists trg_audit_tables on tables;
create trigger trg_audit_tables after insert or update on tables
  for each row execute function fn_audit_trigger();

drop trigger if exists trg_audit_products on products;
create trigger trg_audit_products after insert or update on products
  for each row execute function fn_audit_trigger();
