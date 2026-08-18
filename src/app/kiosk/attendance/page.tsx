import * as kioskService from "@/services/kioskService";
import { getShowDateTimeClock } from "@/services/settingsService";
import KioskClient from "./KioskClient";

// Halaman ini memakai supabaseAdmin (bukan cookies), jadi Next.js tidak
// otomatis mendeteksinya sebagai dynamic. Dipaksa dynamic supaya daftar
// pegawai & status aktif selalu diambil real-time, bukan di-bake saat build.
export const dynamic = "force-dynamic";

export default async function KioskAttendancePage() {
  const [employees, showDateTimeClock] = await Promise.all([
    kioskService.listActiveEmployeesForKiosk(),
    getShowDateTimeClock(),
  ]);
  return <KioskClient employees={employees} showDateTimeClock={showDateTimeClock} />;
}
