import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import { NotificationCenter } from "@/components/dashboard/notification-center";
import { UserMenu } from "@/components/dashboard/user-menu";
import type { PublicUser } from "@/lib/db";
import type { AppNotification } from "@/lib/notifications";

export function DashboardHeader({
  user,
  notifications,
  unreadCount,
}: {
  user: PublicUser;
  notifications: AppNotification[];
  unreadCount: number;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-white/90 px-4 backdrop-blur md:px-7">
      <div className="flex min-w-0 items-center gap-2"><MobileSidebar /><div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-900">Ruang Kerja Admin</p><p className="hidden text-xs text-zinc-500 sm:block">Kelola data dengan mudah dan aman</p></div></div>
      <div className="flex shrink-0 items-center gap-1.5"><NotificationCenter notifications={notifications} unreadCount={unreadCount} /><UserMenu user={user} /></div>
    </header>
  );
}
