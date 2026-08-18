import * as employeeService from "@/services/employeeService";
import { getEmployeeWorkHours } from "@/services/settingsService";
import EmployeesClient from "./EmployeesClient";

export default async function EmployeesPage() {
  const [employees, positions, employeeWorkHours] = await Promise.all([
    employeeService.listEmployees(),
    employeeService.listPositions(),
    getEmployeeWorkHours(),
  ]);
  return <EmployeesClient employees={employees} positions={positions} employeeWorkHours={employeeWorkHours} />;
}
