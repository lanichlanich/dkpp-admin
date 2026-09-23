import type { ReactNode } from "react";
import { DashboardHeader } from "@/components/dashboard/header";
import { DesktopSidebar } from "@/components/dashboard/sidebar";
import { getNotificationCenter } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [user, notificationCenter] = await Promise.all([
    requireUser(),
    getNotificationCenter(),
  ]);
  return (
    <div className="min-h-screen bg-zinc-50/80">
      <DesktopSidebar />
      <div className="lg:pl-64"><DashboardHeader user={user} notifications={notificationCenter.notifications} unreadCount={notificationCenter.unreadCount} /><main className="p-4 md:p-7 lg:p-8">{children}</main></div>
    </div>
  );
}
