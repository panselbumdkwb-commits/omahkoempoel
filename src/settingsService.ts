import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const KEY_SHOW_DATETIME_CLOCK = "ui_show_datetime_clock";
const KEY_CAFE_OPERATING_HOURS = "cafe_operating_hours";
const KEY_EMPLOYEE_WORK_HOURS = "employee_work_hours";
const KEY_KEDAI_NAME = "kedai_name";
const KEY_KEDAI_TAGLINE = "kedai_tagline";
const KEY_KEDAI_ADDRESS = "kedai_address";
const KEY_KEDAI_MAPS_URL = "kedai_maps_url";
const KEY_KEDAI_INSTAGRAM = "kedai_instagram";
const KEY_KEDAI_TIKTOK = "kedai_tiktok";

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

// ----------------------------------------------------------
// PROFIL KEDAI — nama tampilan, tagline, alamat, maps, sosial media.
// Ditampilkan di halaman menu publik (header & footer). Semua boleh
// kosong (fallback default) supaya halaman tetap tampil normal
// sebelum Owner/Admin sempat mengisi lewat halaman Pengaturan.
// ----------------------------------------------------------
export type KedaiProfile = {
  name: string;
  tagline: string;
  address: string;
  mapsUrl: string;
  instagram: string;
  tiktok: string;
};

export async function getKedaiProfile(): Promise<KedaiProfile> {
  const [name, tagline, address, mapsUrl, instagram, tiktok] = await Promise.all([
    getTextSetting(KEY_KEDAI_NAME, "Kedai Omah Koempoel"),
    getTextSetting(KEY_KEDAI_TAGLINE, 'Dari Omah Koempoel — "Tempat bertemu ide gagasan bersama keluarga teman dan kolega"'),
    getTextSetting(KEY_KEDAI_ADDRESS, "Jl. Sultan Hasan Halim, Sisir, Kec. Batu, Kota Batu, Jawa Timur 65314"),
    getTextSetting(
      KEY_KEDAI_MAPS_URL,
      "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("Kedai Omah Koempoel, Jl. Sultan Hasan Halim, Sisir, Kec. Batu, Kota Batu, Jawa Timur 65314")
    ),
    getTextSetting(KEY_KEDAI_INSTAGRAM, "@omahkoempoel"),
    getTextSetting(KEY_KEDAI_TIKTOK, "@omahkoempoel"),
  ]);
  return { name, tagline, address, mapsUrl, instagram, tiktok };
}

export async function setKedaiProfile(input: KedaiProfile) {
  await Promise.all([
    setTextSetting(KEY_KEDAI_NAME, input.name, "Nama tampilan Kedai di halaman menu publik."),
    setTextSetting(KEY_KEDAI_TAGLINE, input.tagline, "Tagline di bawah nama Kedai pada halaman menu publik."),
    setTextSetting(KEY_KEDAI_ADDRESS, input.address, "Alamat Kedai, ditampilkan di footer halaman menu publik."),
    setTextSetting(KEY_KEDAI_MAPS_URL, input.mapsUrl, "Tautan Google Maps lokasi Kedai."),
    setTextSetting(KEY_KEDAI_INSTAGRAM, input.instagram, "Handle Instagram Kedai."),
    setTextSetting(KEY_KEDAI_TIKTOK, input.tiktok, "Handle TikTok Kedai."),
  ]);
}

// ----------------------------------------------------------
// KOORDINAT LOKASI KEDAI — dasar validasi radius 10 meter untuk absen
// masuk lewat HP pribadi pegawai (lihat mobileAttendanceService.ts).
// ----------------------------------------------------------
export async function getBusinessLocation(): Promise<{ latitude: number | null; longitude: number | null }> {
  const { data: business } = await supabaseAdmin.from("business").select("latitude, longitude").limit(1).single();
  return { latitude: business?.latitude ?? null, longitude: business?.longitude ?? null };
}

export async function setBusinessLocation(latitude: number | null, longitude: number | null) {
  const supabase = createSupabaseServerClient();
  const { data: business, error: businessError } = await supabase.from("business").select("id").limit(1).single();
  if (businessError || !business) throw new Error("Konfigurasi bisnis tidak ditemukan.");

  const { error } = await supabase.from("business").update({ latitude, longitude }).eq("id", business.id);
  if (error) {
    throw new Error(`Gagal menyimpan koordinat lokasi Kedai (hanya Super Admin yang boleh mengubah ini): ${error.message}`);
  }
}
