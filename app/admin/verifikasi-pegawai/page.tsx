import { requireAdminOrOwner } from "@/lib/auth";
import * as employeeRegistrationService from "@/services/employeeRegistrationService";
import VerifikasiClient from "./VerifikasiClient";

export default async function VerifikasiPegawaiPage() {
  // Captain, Admin (Super Admin), dan Owner semua boleh memverifikasi
  // pendaftaran akun absensi mandiri pegawai.
  await requireAdminOrOwner();
  const [requests, candidates] = await Promise.all([
    employeeRegistrationService.listPendingRegistrationRequests(),
    employeeRegistrationService.listUnlinkedActiveEmployees(),
  ]);
  return <VerifikasiClient initialRequests={requests} candidates={candidates} />;
}
