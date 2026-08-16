"use server";

import { getSalesReport } from "@/services/reportService";

export async function getSalesReportAction(startISO: string, endISO: string) {
  return getSalesReport(startISO, endISO);
}
