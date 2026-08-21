"use server";

import { getSalesReport, getFinancialStatement } from "@/services/reportService";

export async function getSalesReportAction(startISO: string, endISO: string) {
  return getSalesReport(startISO, endISO);
}

export async function getFinancialStatementAction(startISO: string, endISO: string) {
  return getFinancialStatement(startISO, endISO);
}
