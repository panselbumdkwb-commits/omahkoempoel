import * as employeeService from "@/services/employeeService";
import { getCurrentRole } from "@/lib/auth";
import AttendanceClient from "./AttendanceClient";

export default async function AttendancePage() {
  const role = await getCurrentRole();
  const today = new Date().toISOString().slice(0, 10);
  const [employees, attendance] = await Promise.all([
    employeeService.listEmployees(),
    employeeService.listAttendanceByDate(today),
  ]);

  return <AttendanceClient employees={employees} attendance={attendance} date={today} readOnly={role === "CAPTAIN"} />;
}
