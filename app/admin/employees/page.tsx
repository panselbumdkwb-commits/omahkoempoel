import * as employeeService from "@/services/employeeService";
import { getEmployeeWorkHours } from "@/services/settingsService";
import { requireAdminOrOwner } from "@/lib/auth";
import EmployeesClient from "./EmployeesClient";

export default async function EmployeesPage() {
  // Captain sekarang bisa MENGELOLA (bukan cuma lihat) data pegawai
  // (migration 0018) — tetap lewat requireAdminOrOwner karena Captain
  // masih boleh masuk halaman ini, hanya field gaji pokok yang
  // disembunyikan untuknya (lihat prop role di EmployeesClient).
  const role = await requireAdminOrOwner();
  const [employees, positions, employeeWorkHours] = await Promise.all([
    employeeService.listEmployees(),
    employeeService.listPositions(),
    getEmployeeWorkHours(),
  ]);
  return (
    <EmployeesClient
      employees={employees}
      positions={positions}
      employeeWorkHours={employeeWorkHours}
      role={role}
    />
  );
}
