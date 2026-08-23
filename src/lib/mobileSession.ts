import "server-only";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Sesi login Absen Mandiri (HP pribadi pegawai) — TERPISAH dari sesi
// Supabase Auth yang dipakai staf back-office (Admin/Owner/Captain di
// src/lib/supabase-server.ts). Pegawai login pakai USERNAME (bukan
// email) dan cookie ini sengaja umur SANGAT panjang supaya pegawai
// cuma perlu login sekali di HP-nya masing-masing ("sekali login
// untuk selamanya", lihat migration 0024).
const COOKIE_NAME = "pegawai_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10; // ~10 tahun

function hashToken(token: string): string {
  // sha256 (bukan scrypt) sengaja dipakai di sini: token sumbernya
  // sudah acak 256-bit (randomBytes), jadi tidak butuh hash lambat
  // anti-brute-force seperti password — beda kebutuhan dengan
  // src/lib/password.ts.
  return createHash("sha256").update(token).digest("hex");
}

/** Dipanggil dari Server Action (mis. aksi login) setelah username +
 * password terverifikasi. Membuat baris sesi baru & men-set cookie
 * HttpOnly umur panjang. TIDAK bisa dipanggil langsung dari render
 * Server Component (Next.js App Router hanya izinkan set cookie dari
 * Server Action / Route Handler). */
export async function createMobileSession(employeeId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const { error } = await supabaseAdmin.from("employee_mobile_sessions").insert({
    employee_id: employeeId,
    session_token_hash: hashToken(token),
  });
  if (error) throw new Error(`Gagal membuat sesi login: ${error.message}`);

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/pegawai",
  });
}

/** Pegawai yang sedang login lewat Absen Mandiri, atau null kalau
 * belum/sudah tidak valid (cookie hilang, sesi dicabut Admin lewat
 * "Reset Login HP", atau akun pegawai dinonaktifkan). Dipakai di
 * page.tsx (boleh dipanggil saat render, tidak menulis cookie). */
export async function getMobileSessionEmployee(): Promise<{ id: string; full_name: string } | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  const { data: session } = await supabaseAdmin
    .from("employee_mobile_sessions")
    .select("id, employee_id")
    .eq("session_token_hash", hashToken(token))
    .maybeSingle();
  if (!session) return null;

  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, status")
    .eq("id", session.employee_id)
    .maybeSingle();
  if (!employee || employee.status !== "active") return null;

  // Best-effort, tidak perlu ditunggu/di-throw kalau gagal — cuma jejak
  // "terakhir dipakai" untuk Admin, bukan bagian dari validasi login.
  void supabaseAdmin
    .from("employee_mobile_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", session.id);

  return { id: employee.id, full_name: employee.full_name };
}

/** Gerbang untuk halaman yang WAJIB sudah login (mis. /pegawai/absen,
 * /pegawai/akun) — redirect ke halaman login kalau belum ada sesi
 * valid, konsisten dengan pola requireAdminOrOwner() di lib/auth.ts. */
export async function requireMobileSession(): Promise<{ id: string; full_name: string }> {
  const employee = await getMobileSessionEmployee();
  if (!employee) redirect("/pegawai/login");
  return employee;
}

/** "Keluar" — cabut sesi ini saja (bukan semua sesi/HP pegawai ybs)
 * & hapus cookie. Dipanggil dari Server Action. */
export async function destroyMobileSession(): Promise<void> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (token) {
    await supabaseAdmin.from("employee_mobile_sessions").delete().eq("session_token_hash", hashToken(token));
  }
  cookies().set(COOKIE_NAME, "", { maxAge: 0, path: "/pegawai" });
}
