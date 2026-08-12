-- ============================================================
-- OMAH KOEMPOEL — Patch 0001b: Fix fn_audit_trigger
-- Masalah: NEW.id / NEW.business_id diakses sebagai field record
-- secara langsung, sehingga error saat trigger dipasang di tabel
-- yang tidak punya kolom tsb (mis. role_permissions, tabel junction
-- tanpa id/business_id).
-- Perbaikan: ekstrak via jsonb (->>'id'), bukan akses field record.
-- Cukup jalankan file ini SEKALI setelah 0001 & 0002 — tidak perlu
-- drop/recreate trigger, cukup replace function-nya.
-- ============================================================

create or replace function fn_audit_trigger()
returns trigger
language plpgsql
security definer
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_business_id uuid;
  v_record_id uuid;
begin
  v_new := case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) else null end;
  v_old := case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end;

  -- Aman walau kolom 'business_id' atau 'id' tidak ada di tabel ini
  -- (jsonb ->> pada key yang tidak ada hanya menghasilkan null, tidak error)
  v_business_id := coalesce(
    (v_new->>'business_id')::uuid,
    (v_old->>'business_id')::uuid
  );

  v_record_id := coalesce(
    (v_new->>'id')::uuid,
    (v_old->>'id')::uuid
  );

  insert into audit_logs (business_id, actor_id, action, module, record_id, old_value, new_value)
  values (
    v_business_id,
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    v_old,
    v_new
  );

  return coalesce(NEW, OLD);
end;
$$;

-- Tidak perlu DROP/CREATE TRIGGER ulang — trigger yang sudah terpasang
-- di roles, role_permissions, profiles, employees, system_settings
-- otomatis memakai versi function yang baru (CREATE OR REPLACE).
