import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { hashPin } from "@/lib/pin";
import { setEmployeeMobileLogin } from "@/services/employeeService";

/**
 * Pendaftaran akun absensi mandiri oleh pegawai lewat HP pribadi.
 * Sama seperti kioskService.ts — dipanggil dari halaman PUBLIK tanpa
 * sesi login, jadi pakai supabaseAdmin (bypass RLS) dengan validasi
 * eksplisit di sini, BUKAN dari halaman admin yang sudah punya sesi.
 */
export async function submitRegistrationRequest(input: {
  fullName: string;
  phone: string;
  claimedPositionName?: string;
  claimedEmployeeCode?: string;
}) {
  if (!input.fullName.trim()) throw new Error("Nama lengkap wajib diisi.");
  if (!input.phone.trim()) throw new Error("Nomor HP wajib diisi.");

  const { data: business } = await supabaseAdmin.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  const { error } = await supabaseAdmin.from("employee_registration_requests").insert({
    business_id: business.id,
    full_name: input.fullName.trim(),
    phone: input.phone.trim(),
    claimed_position_name: input.claimedPositionName?.trim() || null,
    claimed_employee_code: input.claimedEmployeeCode?.trim() || null,
  });
  if (error) throw new Error(`Gagal mengirim pendaftaran: ${error.message}`);
}

/** Dipanggil dari halaman admin (sudah login) — pakai client biasa
 * supaya tunduk RLS (hanya Captain/Admin/Owner yang bisa lihat). */
export async function listPendingRegistrationRequests() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employee_registration_requests")
    .select("id, full_name, phone, claimed_position_name, claimed_employee_code, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Gagal memuat antrian pendaftaran: ${error.message}`);
  return data ?? [];
}

/** Kandidat pegawai untuk ditautkan: pegawai aktif yang belum punya PIN
 * absensi (attendance_pin_hash null) — supaya tidak menimpa akun yang
 * sudah dipakai pegawai lain. */
export async function listUnlinkedActiveEmployees() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, employee_code, full_name")
    .eq("status", "active")
    .is("attendance_pin_hash", null)
    .order("full_name");
  if (error) throw new Error(`Gagal memuat daftar pegawai: ${error.message}`);
  return data ?? [];
}

/** Verifikasi: tautkan pendaftaran ke pegawai yang sudah ada di data
 * master (ditambahkan sebelumnya oleh Admin/Owner/Captain di halaman
 * Pegawai), buatkan PIN absensi kios, DAN kredensial login Absen
 * Mandiri (username + password) untuk HP pribadi pegawai — dua-duanya
 * dibuat sekaligus di sini karena inilah momen Admin/Captain pertama
 * kali menyerahkan akses ke pegawai baru (lihat migration 0024).
 * Username & password sementara ditampilkan sekali ke Admin (lewat
 * actions.ts) untuk diteruskan ke pegawai lewat WhatsApp — pegawai
 * WAJIB menggantinya sendiri lewat /pegawai/akun setelah login pertama. */
export async function verifyRegistrationRequest(
  requestId: string,
  employeeId: string,
  pin: string,
  mobileUsername: string,
  mobilePassword: string
) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN harus 4-8 digit angka.");
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi tidak valid.");

  const { error: pinError } = await supabase
    .from("employees")
    .update({ attendance_pin_hash: hashPin(pin) })
    .eq("id", employeeId);
  if (pinError) throw new Error(`Gagal membuat PIN pegawai: ${pinError.message}`);

  await setEmployeeMobileLogin(employeeId, mobileUsername, mobilePassword);

  const { error } = await supabase
    .from("employee_registration_requests")
    .update({ status: "verified", linked_employee_id: employeeId, verified_by: user.id, verified_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw new Error(`Gagal memverifikasi pendaftaran: ${error.message}`);
}

export async function rejectRegistrationRequest(requestId: string, reason?: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi tidak valid.");

  const { error } = await supabase
    .from("employee_registration_requests")
    .update({
      status: "rejected",
      rejection_reason: reason?.trim() || null,
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (error) throw new Error(`Gagal menolak pendaftaran: ${error.message}`);
}
