import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentRole } from "@/lib/auth";

export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = await getCurrentRole();
  if (!role || !["SUPER_ADMIN", "OWNER", "KITCHEN", "CAPTAIN"].includes(role)) {
    redirect("/pos");
  }

  return <div className="min-h-screen bg-background dark:bg-background-dark">{children}</div>;
}
