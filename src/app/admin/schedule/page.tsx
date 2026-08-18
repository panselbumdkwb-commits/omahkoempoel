import * as employeeService from "@/services/employeeService";
import * as scheduleService from "@/services/scheduleService";
import ScheduleClient from "./ScheduleClient";

export default async function SchedulePage() {
  const [employees, schedule] = await Promise.all([
    employeeService.listEmployees(),
    scheduleService.listSchedule(),
  ]);

  const activeEmployees = employees.filter((e: any) => e.status === "active");

  return <ScheduleClient employees={activeEmployees} initialSchedule={schedule} />;
}
