"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentRole, getCurrentUser } from "@/lib/auth";
import * as userService from "@/services/userService";

async function requireSuperAdmin() {
  const role = await getCurrentRole();
  if (role !== "SUPER_ADMIN") {
    redirect("/admin");
  }
}

export async function createUserAction(formData: FormData) {
  await requireSuperAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "");

  if (!email || !fullName || !roleId) throw new Error("Email, nama, dan role wajib diisi.");

  await userService.createUserAccount({ email, password, fullName, roleId });
  revalidatePath("/admin/users");
}

export async function updateUserRoleAction(formData: FormData) {
  await requireSuperAdmin();
  const profileId = String(formData.get("profileId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  if (!profileId || !roleId) throw new Error("Data tidak lengkap.");
  await userService.updateUserRole(profileId, roleId);
  revalidatePath("/admin/users");
}

/** Edit nama (dan role) user dari modal "Edit" di Kelola User. */
export async function updateUserProfileAction(formData: FormData) {
  await requireSuperAdmin();
  const profileId = String(formData.get("profileId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "");
  if (!profileId || !fullName) throw new Error("Nama wajib diisi.");
  await userService.updateUserProfile(profileId, { fullName, roleId: roleId || undefined });
  revalidatePath("/admin/users");
}

/** Reset password user dari modal "Edit" di Kelola User. */
export async function resetUserPasswordAction(formData: FormData) {
  await requireSuperAdmin();
  const profileId = String(formData.get("profileId") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  if (!profileId || !newPassword) throw new Error("Password baru wajib diisi.");
  await userService.resetUserPassword(profileId, newPassword);
  revalidatePath("/admin/users");
}

export async function toggleUserStatusAction(profileId: string, currentStatus: string) {
  await requireSuperAdmin();
  const next = currentStatus === "active" ? "suspended" : "active";
  await userService.setUserStatus(profileId, next as "active" | "suspended");
  revalidatePath("/admin/users");
}

/** Edit email login dari modal "Edit" di Kelola User — login pakai
 * email, jadi ini yang paling sering perlu diubah (typo, ganti nomor/
 * alamat email pegawai, dst). */
export async function updateUserEmailAction(formData: FormData) {
  await requireSuperAdmin();
  const profileId = String(formData.get("profileId") ?? "");
  const newEmail = String(formData.get("newEmail") ?? "").trim();
  if (!profileId || !newEmail) throw new Error("Email baru wajib diisi.");
  await userService.updateUserEmail(profileId, newEmail);
  revalidatePath("/admin/users");
}

/** Hapus akun staf yang sudah tidak dipakai. Lihat catatan di
 * userService.deleteUserAccount untuk kenapa ini soft-delete + ban,
 * bukan hard delete row profiles. */
export async function deleteUserAction(profileId: string) {
  await requireSuperAdmin();
  const currentUser = await getCurrentUser();
  await userService.deleteUserAccount(profileId, currentUser?.id ?? null);
  revalidatePath("/admin/users");
}
