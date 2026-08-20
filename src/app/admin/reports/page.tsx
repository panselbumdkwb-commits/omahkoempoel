import { getSalesReport, getFinancialStatement } from "@/services/reportService";
import { getJakartaTodayRange } from "@/lib/timezone";
import { requireAdminOrOwner } from "@/lib/auth";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage() {
  await requireAdminOrOwner();
  const { startUTC, endUTC } = getJakartaTodayRange();
  const [initialReport, initialFinancials] = await Promise.all([
    getSalesReport(startUTC.toISOString(), endUTC.toISOString()),
    getFinancialStatement(startUTC.toISOString(), endUTC.toISOString()),
  ]);

  return (
    <ReportsClient
      initialReport={initialReport}
      initialFinancials={initialFinancials}
      initialStart={startUTC.toISOString()}
      initialEnd={endUTC.toISOString()}
    />
  );
}
