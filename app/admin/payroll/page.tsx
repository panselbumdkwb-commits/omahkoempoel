import * as payrollService from "@/services/payrollService";
import * as employeeService from "@/services/employeeService";
import { requireSuperAdminOrOwner } from "@/lib/auth";
import PayrollClient from "./PayrollClient";

export default async function PayrollPage() {
  // Captain TIDAK BOLEH melihat/mengelola Payroll (migration 0018) —
  // hanya SUPER_ADMIN/OWNER.
  //
  // Menu Payroll HANYA berisi pencatatan sistem pengupahan pegawai
  // (komponen gaji, gaji pokok per jabatan, jalankan payroll, slip
  // gaji). Biaya operasional/non-operasional cafe (listrik, air, dll)
  // BUKAN bagian dari pengupahan pegawai — dikelola di halaman Laporan
  // (menu Laporan → Biaya Operasional & Non-Operasional) sesuai standar
  // akuntansi, supaya Laporan Laba Rugi jadi satu-satunya tempat
  // pencatatan laporan keuangan lengkap.
  await requireSuperAdminOrOwner();
  const [components, periods, positions] = await Promise.all([
    payrollService.listComponents(),
    payrollService.listPayrollPeriods(),
    employeeService.listPositions(),
  ]);
  return <PayrollClient components={components} periods={periods} positions={positions} />;
}
