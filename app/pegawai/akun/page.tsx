import { requireMobileSession } from "@/lib/mobileSession";
import AkunClient from "./AkunClient";

export const dynamic = "force-dynamic";

export default async function AkunPegawaiPage() {
  const employee = await requireMobileSession();
  return <AkunClient fullName={employee.full_name} />;
}
