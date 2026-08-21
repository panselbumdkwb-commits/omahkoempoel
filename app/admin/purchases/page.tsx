import { requireAdminOrOwner } from "@/lib/auth";
import * as rawMaterialService from "@/services/rawMaterialService";
import * as depreciationService from "@/services/depreciationService";
import PurchasesClient from "./PurchasesClient";

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default async function PurchasesPage() {
  const role = await requireAdminOrOwner();
  const { start, end } = monthRange();

  const [purchases, assets] = await Promise.all([
    rawMaterialService.listPurchases(start, end),
    depreciationService.listAssets(),
  ]);

  return (
    <PurchasesClient
      initialPurchases={purchases}
      assets={assets}
      initialStart={start}
      initialEnd={end}
      role={role}
    />
  );
}
