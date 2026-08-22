import { getSalesReport, getFinancialStatement } from "@/services/reportService";
import * as operationalExpenseService from "@/services/operationalExpenseService";
import { getJakartaTodayRange } from "@/lib/timezone";
import { requireSuperAdminOrOwner } from "@/lib/auth";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage() {
  // Captain TIDAK BOLEH melihat Laporan (migration 0018) — hanya
  // SUPER_ADMIN/OWNER. Captain yang mencoba akses langsung akan
  // dialihkan ke /admin oleh requireSuperAdminOrOwner().
  await requireSuperAdminOrOwner();
  const { startUTC, endUTC } = getJakartaTodayRange();
  const [initialReport, initialFinancials, expenses] = await Promise.all([
    getSalesReport(startUTC.toISOString(), endUTC.toISOString()),
    getFinancialStatement(startUTC.toISOString(), endUTC.toISOString()),
    operationalExpenseService.listExpenses(),
  ]);

  return (
    <ReportsClient
      initialReport={initialReport}
      initialFinancials={initialFinancials}
      initialStart={startUTC.toISOString()}
      initialEnd={endUTC.toISOString()}
      expenses={expenses}
    />
  );
}
