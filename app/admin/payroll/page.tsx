import * as payrollService from "@/services/payrollService";
import * as employeeService from "@/services/employeeService";
import * as operationalExpenseService from "@/services/operationalExpenseService";
import { requireSuperAdminOrOwner } from "@/lib/auth";
import PayrollClient from "./PayrollClient";

export default async function PayrollPage() {
  // Captain TIDAK BOLEH melihat/mengelola Payroll (migration 0018) —
  // hanya SUPER_ADMIN/OWNER.
  await requireSuperAdminOrOwner();
  const [components, periods, positions, expenses] = await Promise.all([
    payrollService.listComponents(),
    payrollService.listPayrollPeriods(),
    employeeService.listPositions(),
    operationalExpenseService.listExpenses(),
  ]);
  return <PayrollClient components={components} periods={periods} positions={positions} expenses={expenses} />;
}
