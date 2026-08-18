import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const KEY_SHOW_DATETIME_CLOCK = "ui_show_datetime_clock";
const KEY_CAFE_OPERATING_HOURS = "cafe_operating_hours";
const KEY_EMPLOYEE_WORK_HOURS = "employee_work_hours";

/**
 * Baca setelan tampilan jam Hari/Tanggal/Waktu. Dipakai lewat supabaseAdmin
 * (bukan client session) karena perlu bisa dibaca dari halaman publik tanpa
 * login (menu pembeli, kiosk absensi) — bukan cuma dari akun staf.
 * Default TRUE kalau belum pernah diatur (baris belum ada).
 */
export async function getShowDateTimeClock(): Promise<boolean> {
  const { data: business } = await supabaseAdmin.from("business").select("id").limit(1).single();
  if (!business) return true;

  const { data } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("business_id", business.id)
    .eq("key", KEY_SHOW_DATETIME_CLOCK)
    .maybeSingle();

  if (!data) return true;
  return data.value === true || data.value === "true";
}

/**
 * Ubah setelan (dipanggil dari halaman Admin). Memakai session staf yang
 * login (bukan admin client) supaya kebijakan RLS `system_settings_manage`
 * (khusus SUPER_ADMIN) tetap berlaku — mencegah role lain mengubahnya.
 */
export async function setShowDateTimeClock(value: boolean) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: business, error: businessError } = await supabase
    .from("business")
    .select("id")
    .limit(1)
    .single();
  if (businessError || !business) throw new Error("Konfigurasi bisnis tidak ditemukan.");

  const { error } = await supabase.from("system_settings").upsert(
    {
      business_id: business.id,
      key: KEY_SHOW_DATETIME_CLOCK,
      value,
      description: "Tampilkan widget Hari/Tanggal/Waktu (WIB) di seluruh halaman aplikasi.",
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,key" }
  );
  if (error) {
    throw new Error(
      `Gagal menyimpan pengaturan (hanya Super Admin yang boleh mengubah ini): ${error.message}`
    );
  }
}

/** Helper generik: baca 1 setelan bertipe teks bebas (dipakai untuk jam
 * buka cafe & jam kerja pegawai — bukan boolean seperti clock di atas). */
async function getTextSetting(key: string, fallback: string): Promise<string> {
  const { data: business } = await supabaseAdmin.from("business").select("id").limit(1).single();
  if (!business) return fallback;

  const { data } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("business_id", business.id)
    .eq("key", key)
    .maybeSingle();

  if (!data || typeof data.value !== "string") return fallback;
  return data.value;
}

async function setTextSetting(key: string, value: string, description: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: business, error: businessError } = await supabase
    .from("business")
    .select("id")
    .limit(1)
    .single();
  if (businessError || !business) throw new Error("Konfigurasi bisnis tidak ditemukan.");

  const { error } = await supabase.from("system_settings").upsert(
    {
      business_id: business.id,
      key,
      value,
      description,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,key" }
  );
  if (error) {
    throw new Error(
      `Gagal menyimpan pengaturan (hanya Super Admin yang boleh mengubah ini): ${error.message}`
    );
  }
}

/** Jam buka cafe, mis. "08:00 – 22:00 WIB". Ditampilkan di halaman menu
 * publik. Default kalau belum pernah diatur Owner/Admin. */
export async function getCafeOperatingHours(): Promise<string> {
  return getTextSetting(KEY_CAFE_OPERATING_HOURS, "08:00 – 22:00 WIB");
}
export async function setCafeOperatingHours(value: string) {
  return setTextSetting(KEY_CAFE_OPERATING_HOURS, value, "Jam buka cafe, ditampilkan di halaman menu pembeli.");
}

/** Jam kerja pegawai secara umum (deskripsi bebas, mis. daftar shift).
 * Ini beda dari jadwal per-pegawai-per-hari di scheduleService — ini
 * kebijakan umum yang ditampilkan sebagai info, bukan grid terjadwal. */
export async function getEmployeeWorkHours(): Promise<string> {
  return getTextSetting(
    KEY_EMPLOYEE_WORK_HOURS,
    "Shift Pagi: 07:00 – 15:00 · Shift Sore: 15:00 – 23:00"
  );
}
export async function setEmployeeWorkHours(value: string) {
  return setTextSetting(
    KEY_EMPLOYEE_WORK_HOURS,
    value,
    "Jam kerja pegawai (kebijakan shift umum), ditampilkan di halaman admin/kiosk absensi."
  );
}
