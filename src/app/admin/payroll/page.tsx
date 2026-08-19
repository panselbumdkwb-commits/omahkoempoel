import * as payrollService from "@/services/payrollService";
import * as employeeService from "@/services/employeeService";
import * as operationalExpenseService from "@/services/operationalExpenseService";
import PayrollClient from "./PayrollClient";

export default async function PayrollPage() {
  const [components, periods, positions, expenses] = await Promise.all([
    payrollService.listComponents(),
    payrollService.listPayrollPeriods(),
    employeeService.listPositions(),
    operationalExpenseService.listExpenses(),
  ]);
  return <PayrollClient components={components} periods={periods} positions={positions} expenses={expenses} />;
}
