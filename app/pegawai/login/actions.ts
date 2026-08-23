"use server";

import { redirect } from "next/navigation";
import * as mobileAttendanceService from "@/services/mobileAttendanceService";
import { createMobileSession } from "@/lib/mobileSession";

export async function loginMobileAction(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const employee = await mobileAttendanceService.loginMobile(username, password);
  await createMobileSession(employee.id);
  redirect("/pegawai/absen");
}
