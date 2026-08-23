"use server";

import { redirect } from "next/navigation";
import * as mobileAttendanceService from "@/services/mobileAttendanceService";
import { requireMobileSession, destroyMobileSession } from "@/lib/mobileSession";

export async function changePasswordAction(formData: FormData) {
  const employee = await requireMobileSession();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) {
    throw new Error("Konfirmasi password baru tidak sama.");
  }
  await mobileAttendanceService.changeMobilePassword(employee.id, currentPassword, newPassword);
}

export async function logoutMobileAction() {
  await destroyMobileSession();
  redirect("/pegawai/login");
}
