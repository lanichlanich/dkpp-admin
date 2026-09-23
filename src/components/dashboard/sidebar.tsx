"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, BarChart3, ClipboardList, FileCheck2, FileSignature, House, LayoutDashboard, Scale, ScrollText, Send, UserRound, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Daftar Pegawai", href: "/dashboard/pegawai", icon: UsersRound },
  { label: "Daftar Hukdis", href: "/dashboard/hukdis", icon: Scale },
  { label: "Surat HUKDIS & HUKDA", href: "/dashboard/surat-hukdis-hukda", icon: FileCheck2 },
  { label: "Surat Tugas WFH", href: "/dashboard/wfh", icon: House },
  { label: "Laporan WFH", href: "/dashboard/laporan-wfh", icon: ClipboardList },
  { label: "Surat Pengantar", href: "/dashboard/surat-pengantar", icon: Send },
  { label: "Pembuatan DPCP", href: "/dashboard/dpcp", icon: ScrollText },
  { label: "Pembuatan PAK", href: "/dashboard/pak", icon: Award },
  { label: "Pembuatan SK KGB", href: "/dashboard/kgb", icon: FileSignature },
  { label: "Profil Saya", href: "/dashboard/profile", icon: UserRound },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-300">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"><BarChart3 aria-hidden="true" className="size-4.5" /></span>
        <div className="min-w-0 flex-1"><p className="font-semibold leading-5 text-white">AdminFlow</p><p className="truncate text-[11px] text-zinc-400">Administrasi Kepegawaian</p></div>
        {onNavigate && <Button variant="ghost" size="icon" onClick={onNavigate} aria-label="Tutup menu" className="size-11 shrink-0 text-zinc-300 hover:bg-white/10 hover:text-white"><X className="size-4" /></Button>}
      </div>
      <nav aria-label="Menu utama" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-6">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Menu utama</p>
        {navigation.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400", active ? "bg-indigo-500 text-white shadow-md shadow-indigo-950/30" : "text-zinc-300 hover:bg-white/5 hover:text-white")}>
              <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} /><span className="min-w-0 leading-5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-white/10 p-4">
        <div className="rounded-lg bg-white/[0.04] p-3 text-xs leading-5 text-zinc-400"><p className="font-medium text-zinc-200">AdminFlow</p><p>Ruang kerja administrasi pegawai</p></div>
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-zinc-800 lg:block"><SidebarContent /></aside>;
}
