import type { ReactNode } from "react";
import { DashboardHeader } from "@/components/dashboard/header";
import { DashboardShell } from "@/components/dashboard/shell";
import { getNotificationCenter } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [user, notificationCenter] = await Promise.all([
    requireUser(),
    getNotificationCenter(),
  ]);
  return (
    <DashboardShell user={user}>
      <DashboardHeader user={user} notifications={notificationCenter.notifications} unreadCount={notificationCenter.unreadCount} /><main className="p-4 md:p-7 lg:p-8">{children}</main>
    </DashboardShell>
  );
}
