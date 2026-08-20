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

/** Gerbang untuk halaman admin (Dashboard, Laporan, Kelola Menu,
 * Pegawai, Absensi, Payroll, QR Meja, Jadwal Shift, Pengaturan).
 * CAPTAIN diberi akses 'view' penuh yang setara SUPER_ADMIN/OWNER di
 * semua halaman ini (lihat migration 0016) — tapi TIDAK bisa
 * menulis/mengubah data apa pun di luar wewenang KASIR-nya, karena
 * setiap server action menulis lewat RLS yang masih membatasi
 * *_manage/*_rw hanya untuk SUPER_ADMIN/OWNER. Jadi guard ini cukup
 * dipakai di page.tsx (baca data), bukan di actions.ts (tulis data) —
 * pertahanan tulis-data ada di database, bukan di sini.
 * Dikembalikan role-nya supaya halaman pemanggil tidak perlu panggil
 * getCurrentRole() dua kali kalau masih butuh nilainya.
 */
export async function requireAdminOrOwner(): Promise<string> {
  const role = await getCurrentRole();
  if (!role || !["SUPER_ADMIN", "OWNER", "CAPTAIN"].includes(role)) {
    redirect("/pos");
  }
  return role;
}

/** Khusus halaman yang WAJIB SUPER_ADMIN/OWNER saja, tidak boleh
 * dilihat CAPTAIN sama sekali (mis. Kelola User — Bagian 27 master
 * prompt: Owner tidak boleh mengubah user permission, apalagi Captain).
 */
export async function requireSuperAdminOrOwner(): Promise<string> {
  const role = await getCurrentRole();
  if (!role || !["SUPER_ADMIN", "OWNER"].includes(role)) {
    redirect("/admin");
  }
  return role;
}
