"use server";

import * as kioskService from "@/services/kioskService";

export async function listKioskEmployeesAction() {
  return kioskService.listActiveEmployeesForKiosk();
}

export async function kioskClockAction(employeeId: string, pin: string, action: "in" | "out") {
  return kioskService.kioskClockAttendance(employeeId, pin, action);
}

export async function getTodayScheduleAction(employeeId: string) {
  return kioskService.getTodayScheduleForEmployee(employeeId);
}
