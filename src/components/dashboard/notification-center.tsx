"use client";

import { useTransition } from "react";
import { Bell, CheckCheck, CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { markNotificationsReadAction } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import type { AppNotification, NotificationType } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const notificationStyle: Record<NotificationType, { icon: typeof Info; className: string }> = {
  success: { icon: CircleCheck, className: "bg-emerald-50 text-emerald-600" },
  warning: { icon: TriangleAlert, className: "bg-amber-50 text-amber-600" },
  error: { icon: CircleX, className: "bg-red-50 text-red-600" },
  info: { icon: Info, className: "bg-sky-50 text-sky-600" },
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function NotificationCenter({ notifications, unreadCount }: { notifications: AppNotification[]; unreadCount: number }) {
  const [pending, startTransition] = useTransition();

  function markAllRead() {
    startTransition(async () => {
      await markNotificationsReadAction();
      toast.info("Semua notifikasi telah ditandai dibaca.");
    });
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative size-11 text-zinc-600" aria-label={`Buka notifikasi${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ""}`} />}>
        <Bell aria-hidden="true" className="size-5 shrink-0" />
        {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0">
        <PopoverHeader className="border-b p-4">
          <div className="flex items-center justify-between gap-3"><PopoverTitle>Notifikasi</PopoverTitle>{unreadCount > 0 && <Button variant="ghost" size="sm" disabled={pending} onClick={markAllRead}><CheckCheck className="size-3.5" />Tandai dibaca</Button>}</div>
          <PopoverDescription>{unreadCount > 0 ? `${unreadCount} aktivitas belum dibaca` : "Semua aktivitas sudah dibaca"}</PopoverDescription>
        </PopoverHeader>
        <div className="max-h-[26rem] overflow-y-auto p-2">
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-zinc-500">Belum ada notifikasi.</div>
          ) : notifications.map((notification) => {
            const config = notificationStyle[notification.type];
            const Icon = config.icon;
            return (
              <div key={notification.id} className={cn("flex gap-3 rounded-lg p-3", !notification.readAt && "bg-indigo-50/50")}>
                <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", config.className)}><Icon className="size-4" /></span>
                <div className="min-w-0"><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-zinc-900">{notification.title}</p>{!notification.readAt && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-indigo-600" />}</div><p className="mt-1 text-xs leading-5 text-zinc-500">{notification.description}</p><p className="mt-1.5 text-[10px] text-zinc-400">{formatTime(notification.createdAt)}</p></div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
