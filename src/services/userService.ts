import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Daftar user beserta email login-nya. Email TIDAK disimpan di tabel
 * profiles (lihat createUserAccount) — sumber kebenarannya auth.users,
 * jadi diambil lewat supabaseAdmin.auth.admin.listUsers() lalu
 * digabung ke tiap baris profil berdasarkan id (profiles.id selalu
 * sama dengan auth user id). Akun yang sudah dihapus (deleted_at
 * terisi, lihat deleteUserAccount) tidak ikut ditampilkan.
 */
export async function listUsers() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, status, created_at, roles(code, name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal memuat daftar user: ${error.message}`);

  const { data: authList, error: authError } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 200,
  });
  if (authError) throw new Error(`Gagal memuat email user: ${authError.message}`);
  const emailById = new Map(authList.users.map((u) => [u.id, u.email ?? ""]));

  return (data ?? []).map((u) => ({ ...u, email: emailById.get(u.id) ?? "" }));
}

export async function listRoles() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("roles").select("id, code, name").order("name");
  if (error) throw new Error(`Gagal memuat daftar role: ${error.message}`);
  return data ?? [];
}

/**
 * Membuat akun staf baru (mis. untuk "Omah Mburi"/Dapur, Kasir baru, dst).
 * INI SATU-SATUNYA tempat lain yang boleh memakai supabaseAdmin, karena
 * membuat akun Supabase Auth memang butuh service role — tidak bisa lewat
 * client biasa. Dibatasi ketat: hanya dipanggil dari halaman yang sudah
 * memverifikasi role SUPER_ADMIN di server (lihat /admin/users/page.tsx),
 * dan operasi ini sendiri tidak bergantung pada RLS.
 */
export async function createUserAccount(input: {
  email: string;
  password: string;
  fullName: string;
  roleId: string;
}) {
  if (input.password.length < 8) {
    throw new Error("Password minimal 8 karakter.");
  }

  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    throw new Error(`Gagal membuat akun: ${authError?.message ?? "unknown error"}`);
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: authUser.user.id,
    business_id: business.id,
    full_name: input.fullName,
    role_id: input.roleId,
  });

  if (profileError) {
    // Rollback: jangan tinggalkan auth user "yatim" tanpa profile/role.
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(`Gagal menghubungkan akun ke role: ${profileError.message}`);
  }

  return { userId: authUser.user.id };
}

export async function updateUserRole(profileId: string, roleId: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ role_id: roleId }).eq("id", profileId);
  if (error) throw new Error(`Gagal mengubah role: ${error.message}`);
}

/**
 * Edit data dasar user (nama & role sekaligus) dari Kelola User.
 * roleId opsional supaya bisa dipanggil dari form yang cuma mengubah
 * nama tanpa harus mengirim ulang role yang sudah ada.
 */
export async function updateUserProfile(
  profileId: string,
  input: { fullName: string; roleId?: string }
) {
  if (!input.fullName.trim()) throw new Error("Nama tidak boleh kosong.");

  const supabase = createSupabaseServerClient();
  const payload: Record<string, string> = { full_name: input.fullName.trim() };
  if (input.roleId) payload.role_id = input.roleId;

  const { error } = await supabase.from("profiles").update(payload).eq("id", profileId);
  if (error) throw new Error(`Gagal menyimpan perubahan user: ${error.message}`);
}

/**
 * Reset password akun staf. Sama seperti createUserAccount, ini butuh
 * service role (supabaseAdmin) karena mengubah password Supabase Auth
 * bukan hal yang bisa dilakukan lewat client biasa / RLS. profiles.id
 * selalu sama dengan auth user id (lihat createUserAccount di atas),
 * jadi profileId bisa langsung dipakai sebagai target user id.
 */
export async function resetUserPassword(profileId: string, newPassword: string) {
  if (newPassword.length < 8) {
    throw new Error("Password minimal 8 karakter.");
  }
  const { error } = await supabaseAdmin.auth.admin.updateUserById(profileId, {
    password: newPassword,
  });
  if (error) throw new Error(`Gagal mereset password: ${error.message}`);
}

export async function setUserStatus(profileId: string, status: "active" | "suspended") {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ status }).eq("id", profileId);
  if (error) throw new Error(`Gagal mengubah status user: ${error.message}`);
}

/**
 * Edit email login user (Kelola User). Butuh supabaseAdmin karena
 * mengubah email di Supabase Auth bukan operasi yang bisa lewat client
 * biasa. email_confirm: true supaya email baru langsung aktif dipakai
 * login tanpa perlu verifikasi lewat tautan email (akun staf internal,
 * bukan pendaftaran publik).
 */
export async function updateUserEmail(profileId: string, newEmail: string) {
  const email = newEmail.trim();
  if (!email) throw new Error("Email tidak boleh kosong.");

  const { error } = await supabaseAdmin.auth.admin.updateUserById(profileId, {
    email,
    email_confirm: true,
  });
  if (error) throw new Error(`Gagal mengubah email: ${error.message}`);
}

/**
 * Hapus akun staf yang sudah tidak dipakai dari Kelola User.
 *
 * Dipakai SOFT DELETE (profiles.deleted_at) — bukan hard delete row
 * profiles — karena employees.profile_id masih boleh mereferensikan
 * profil ini untuk riwayat pegawai/payroll/absensi (hard delete akan
 * gagal kena FK constraint kalau profil ini pernah dipakai, atau
 * merusak riwayat kalau berhasil). Supabase Auth user juga di-ban
 * permanen (bukan cuma profiles.status='suspended') supaya akun ini
 * BENAR-BENAR tidak bisa login lagi — sign-in Supabase Auth tidak
 * mengecek profiles.status sama sekali, jadi kalau tidak di-ban,
 * kredensial lama tetap bisa dipakai login walau sudah "dihapus".
 */
export async function deleteUserAccount(profileId: string, currentUserId: string | null) {
  if (currentUserId && profileId === currentUserId) {
    throw new Error("Tidak bisa menghapus akun yang sedang Anda pakai untuk login.");
  }

  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(profileId, {
    ban_duration: "876000h", // ~100 tahun, efektif permanen
  });
  if (banError) throw new Error(`Gagal menonaktifkan akun: ${banError.message}`);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString(), status: "suspended" })
    .eq("id", profileId);
  if (error) throw new Error(`Gagal menghapus akun: ${error.message}`);
}
