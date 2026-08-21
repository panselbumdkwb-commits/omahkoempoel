"use server";

import * as mobileAttendanceService from "@/services/mobileAttendanceService";

export async function listVerifiedEmployeesAction() {
  return mobileAttendanceService.listVerifiedMobileEmployees();
}

export async function mobileClockAction(
  employeeId: string,
  pin: string,
  action: "in" | "out",
  lat: number,
  lng: number
) {
  return mobileAttendanceService.mobileClockAttendance(employeeId, pin, action, { lat, lng });
}

export async function submitLeaveAction(employeeId: string, pin: string, reason: string) {
  return mobileAttendanceService.submitLeaveRequest(employeeId, pin, reason);
}
