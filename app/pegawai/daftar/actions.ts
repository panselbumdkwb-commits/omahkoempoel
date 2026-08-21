"use server";

import * as employeeRegistrationService from "@/services/employeeRegistrationService";

export async function submitRegistrationAction(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const claimedPositionName = String(formData.get("claimedPositionName") ?? "");
  const claimedEmployeeCode = String(formData.get("claimedEmployeeCode") ?? "");

  await employeeRegistrationService.submitRegistrationRequest({
    fullName,
    phone,
    claimedPositionName,
    claimedEmployeeCode,
  });
}
