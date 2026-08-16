import * as employeeService from "@/services/employeeService";
import AttendanceClient from "./AttendanceClient";

export default async function AttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [employees, attendance] = await Promise.all([
    employeeService.listEmployees(),
    employeeService.listAttendanceByDate(today),
  ]);

  return <AttendanceClient employees={employees} attendance={attendance} date={today} />;
}
