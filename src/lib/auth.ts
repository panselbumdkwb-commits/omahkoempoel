import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** Mengambil role code user yang sedang login, lewat fn_current_role_code()
 * yang sama dipakai RLS — supaya cek di UI selalu konsisten dengan aturan
 * yang ditegakkan di database (bukan logika terpisah yang bisa berbeda). */
export async function getCurrentRole(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("fn_current_role_code");
  if (error) return null;
  return data ?? null;
}

export async function getCurrentUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Defense in depth untuk halaman admin yang BUKAN Jadwal Shift/Absensi
 * (mis. Payroll, Kelola Menu, Pegawai, Laporan, QR Meja, Pengaturan).
 * /admin/layout.tsx sudah izinkan role CAPTAIN masuk ke /admin secara
 * umum (supaya bisa lihat Jadwal Shift & Absensi — lihat migration 0014),
 * jadi tiap halaman admin LAIN yang memang harus SUPER_ADMIN/OWNER saja
 * wajib panggil ini di awal supaya Captain tidak bisa buka lewat URL
 * langsung. Dikembalikan role-nya supaya halaman pemanggil tidak perlu
 * panggil getCurrentRole() dua kali kalau masih butuh nilainya.
 */
export async function requireAdminOrOwner(): Promise<string> {
  const role = await getCurrentRole();
  if (!role || !["SUPER_ADMIN", "OWNER"].includes(role)) {
    redirect("/admin/schedule");
  }
  return role;
}
