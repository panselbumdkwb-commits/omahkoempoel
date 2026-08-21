import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth";
import * as userService from "@/services/userService";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  // Defense in depth: /admin layout sudah izinkan SUPER_ADMIN & OWNER,
  // tapi kelola user WAJIB hanya SUPER_ADMIN (Bagian 27 master prompt:
  // Owner tidak boleh mengubah user permission).
  const role = await getCurrentRole();
  if (role !== "SUPER_ADMIN") {
    redirect("/admin");
  }

  const [users, roles] = await Promise.all([userService.listUsers(), userService.listRoles()]);
  return <UsersClient users={users} roles={roles} />;
}
