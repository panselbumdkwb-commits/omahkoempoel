"use server";

import { revalidatePath } from "next/cache";
import * as employeeRegistrationService from "@/services/employeeRegistrationService";

export async function listPendingRegistrationRequestsAction() {
  return employeeRegistrationService.listPendingRegistrationRequests();
}

export async function listUnlinkedActiveEmployeesAction() {
  return employeeRegistrationService.listUnlinkedActiveEmployees();
}

export async function verifyRegistrationRequestAction(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  const pin = String(formData.get("pin") ?? "");
  await employeeRegistrationService.verifyRegistrationRequest(requestId, employeeId, pin);
  revalidatePath("/admin/verifikasi-pegawai");
}

export async function rejectRegistrationRequestAction(requestId: string, reason: string) {
  await employeeRegistrationService.rejectRegistrationRequest(requestId, reason);
  revalidatePath("/admin/verifikasi-pegawai");
}
