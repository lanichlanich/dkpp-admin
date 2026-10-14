"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { DesktopSidebar } from "@/components/dashboard/sidebar";
import { cn } from "@/lib/utils";
import { AccessContext } from "@/components/dashboard/access-context";
import type { PublicUser } from "@/lib/db-types";

const preferenceKey = "dkpp-admin.sidebar-collapsed";
const preferenceEvent = "dkpp-sidebar-change";
let fallbackCollapsed = false;
function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === preferenceKey || event.key === null) callback(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(preferenceEvent, callback);
  return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(preferenceEvent, callback); };
}
function getSnapshot() {
  try { return window.localStorage.getItem(preferenceKey) === "true"; }
  catch { return fallbackCollapsed; }
}
const getServerSnapshot = () => false;

export function DashboardShell({ children, user }: { children: ReactNode; user: PublicUser }) {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = () => {
    fallbackCollapsed = !collapsed;
    try { window.localStorage.setItem(preferenceKey, String(fallbackCollapsed)); }
    catch { /* The sidebar also works when browser storage is unavailable. */ }
    window.dispatchEvent(new Event(preferenceEvent));
  };
  return <AccessContext.Provider value={user}><div className="min-h-screen bg-zinc-50/80">
    <DesktopSidebar collapsed={collapsed} onToggle={toggle} />
    <div className={cn("transition-[padding] duration-200 motion-reduce:transition-none", collapsed ? "lg:pl-20" : "lg:pl-64")}>{children}</div>
  </div></AccessContext.Provider>;
}
