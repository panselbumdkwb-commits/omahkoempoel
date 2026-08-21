"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth";
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
