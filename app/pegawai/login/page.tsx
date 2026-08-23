import { redirect } from "next/navigation";
import { getMobileSessionEmployee } from "@/lib/mobileSession";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPegawaiPage() {
  // Sudah ada sesi valid (mis. pegawai buka /pegawai/login lagi padahal
  // sudah login) -> langsung ke halaman absen, tidak perlu login dua
  // kali (sesuai "sekali login untuk selamanya").
  const employee = await getMobileSessionEmployee();
  if (employee) redirect("/pegawai/absen");

  return <LoginClient />;
}
