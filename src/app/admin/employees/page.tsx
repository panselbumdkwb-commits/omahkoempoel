import * as employeeService from "@/services/employeeService";
import EmployeesClient from "./EmployeesClient";

export default async function EmployeesPage() {
  const [employees, positions] = await Promise.all([
    employeeService.listEmployees(),
    employeeService.listPositions(),
  ]);
  return <EmployeesClient employees={employees} positions={positions} />;
}
