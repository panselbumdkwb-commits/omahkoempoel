import * as kioskService from "@/services/kioskService";
import KioskClient from "./KioskClient";

// Halaman ini memakai supabaseAdmin (bukan cookies), jadi Next.js tidak
// otomatis mendeteksinya sebagai dynamic. Dipaksa dynamic supaya daftar
// pegawai & status aktif selalu diambil real-time, bukan di-bake saat build.
export const dynamic = "force-dynamic";

export default async function KioskAttendancePage() {
  const employees = await kioskService.listActiveEmployeesForKiosk();
  return <KioskClient employees={employees} />;
}
