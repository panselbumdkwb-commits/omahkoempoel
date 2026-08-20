import * as employeeService from "@/services/employeeService";
import { getEmployeeWorkHours } from "@/services/settingsService";
import { requireAdminOrOwner } from "@/lib/auth";
import EmployeesClient from "./EmployeesClient";

export default async function EmployeesPage() {
  await requireAdminOrOwner();
  const [employees, positions, employeeWorkHours] = await Promise.all([
    employeeService.listEmployees(),
    employeeService.listPositions(),
    getEmployeeWorkHours(),
  ]);
  return <EmployeesClient employees={employees} positions={positions} employeeWorkHours={employeeWorkHours} />;
}
