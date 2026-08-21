import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentRole } from "@/lib/auth";

export default async function BarLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = await getCurrentRole();
  if (!role || !["SUPER_ADMIN", "OWNER", "BAR", "CAPTAIN"].includes(role)) {
    redirect("/pos");
  }

  return <div className="min-h-screen bg-background dark:bg-background-dark">{children}</div>;
}
