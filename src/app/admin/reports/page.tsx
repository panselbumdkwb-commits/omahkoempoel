import { getSalesReport } from "@/services/reportService";
import { getJakartaTodayRange } from "@/lib/timezone";
import { requireAdminOrOwner } from "@/lib/auth";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage() {
  await requireAdminOrOwner();
  const { startUTC, endUTC } = getJakartaTodayRange();
  const initialReport = await getSalesReport(startUTC.toISOString(), endUTC.toISOString());

  return (
    <ReportsClient
      initialReport={initialReport}
      initialStart={startUTC.toISOString()}
      initialEnd={endUTC.toISOString()}
    />
  );
}
