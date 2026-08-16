import * as payrollService from "@/services/payrollService";
import PayrollClient from "./PayrollClient";

export default async function PayrollPage() {
  const [components, periods] = await Promise.all([
    payrollService.listComponents(),
    payrollService.listPayrollPeriods(),
  ]);
  return <PayrollClient components={components} periods={periods} />;
}
