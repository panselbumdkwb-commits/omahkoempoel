import * as employeeService from "@/services/employeeService";
import * as scheduleService from "@/services/scheduleService";
import { getCurrentRole } from "@/lib/auth";
import ScheduleClient from "./ScheduleClient";

function currentWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Minggu
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

export default async function SchedulePage() {
  const role = await getCurrentRole();
  const { start, end } = currentWeekRange();
  const [employees, schedule, attendanceThisWeek] = await Promise.all([
    employeeService.listEmployees(),
    scheduleService.listSchedule(),
    employeeService.listAttendanceForRange(start, end),
  ]);

  const activeEmployees = employees.filter((e: any) => e.status === "active");

  // Captain HANYA boleh melihat (susun/ubah jadwal tetap wewenang
  // SUPER_ADMIN/OWNER — lihat migration 0014 & requireAdminOrOwner()).
  const readOnly = role === "CAPTAIN";

  return (
    <ScheduleClient
      employees={activeEmployees}
      initialSchedule={schedule}
      readOnly={readOnly}
      attendanceHighlights={attendanceThisWeek.filter((a: any) => a.status !== "present")}
      weekRange={{ start, end }}
    />
  );
}
