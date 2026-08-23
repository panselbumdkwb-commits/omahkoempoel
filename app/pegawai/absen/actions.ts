"use server";

import * as mobileAttendanceService from "@/services/mobileAttendanceService";
import { requireMobileSession } from "@/lib/mobileSession";

export async function mobileClockAction(
  action: "in" | "out",
  lat: number,
  lng: number,
  photoDataUrl?: string | null
) {
  const employee = await requireMobileSession();
  return mobileAttendanceService.mobileClockAttendance(employee.id, action, { lat, lng }, photoDataUrl);
}

export async function submitLeaveAction(reason: string) {
  const employee = await requireMobileSession();
  return mobileAttendanceService.submitLeaveRequest(employee.id, reason);
}
