import * as mobileAttendanceService from "@/services/mobileAttendanceService";
import AbsenClient from "./AbsenClient";

export const dynamic = "force-dynamic";

export default async function AbsenMandiriPage() {
  const employees = await mobileAttendanceService.listVerifiedMobileEmployees();
  return <AbsenClient employees={employees} />;
}
