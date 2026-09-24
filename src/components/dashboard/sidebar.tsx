"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Award, BriefcaseBusiness, ChevronDown, ClipboardList, FileCheck2, FileSignature, House, LayoutDashboard, Scale, ScrollText, Send, UserRound, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const personnelNavigation = [
  { label: "Daftar Pegawai", href: "/dashboard/pegawai", icon: UsersRound },
  { label: "Daftar Hukdis", href: "/dashboard/hukdis", icon: Scale },
  { label: "Surat HUKDIS & HUKDA", href: "/dashboard/surat-hukdis-hukda", icon: FileCheck2 },
  { label: "Surat Tugas WFH", href: "/dashboard/wfh", icon: House },
  { label: "Laporan WFH", href: "/dashboard/laporan-wfh", icon: ClipboardList },
  { label: "DPCP", href: "/dashboard/dpcp", icon: ScrollText },
  { label: "PAK", href: "/dashboard/pak", icon: Award },
  { label: "SK KGB", href: "/dashboard/kgb", icon: FileSignature },
];

const navigation = [
  { label: "Surat Pengantar", href: "/dashboard/surat-pengantar", icon: Send },
  { label: "Profil Saya", href: "/dashboard/profile", icon: UserRound },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const personnelActive = personnelNavigation.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const [personnelOpen, setPersonnelOpen] = useState(personnelActive);
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-emerald-600 via-green-700 to-sky-700 text-emerald-50">
      <div className="flex h-20 shrink-0 items-center gap-3 border-b border-white/20 bg-white/[0.08] px-3.5">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white p-1 shadow-lg shadow-emerald-950/25 ring-1 ring-amber-200/70"><Image src="/dkpp-admin-logo.png" alt="" width={52} height={52} className="size-12 object-contain" priority /></span>
        <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold leading-5 text-white">DKPP-Admin</p><p className="truncate text-[11px] text-emerald-100/85">Administrasi Kepegawaian</p></div>
        {onNavigate && <Button variant="ghost" size="icon" onClick={onNavigate} aria-label="Tutup menu" className="size-10 shrink-0 text-white/85 hover:bg-white/15 hover:text-white"><X className="size-4" /></Button>}
      </div>
      <nav aria-label="Menu utama" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-6">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">Menu utama</p>
        {(() => {
          const active = pathname === "/dashboard";
          return <Link href="/dashboard" onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", active ? "bg-white text-emerald-800 shadow-md shadow-emerald-950/20" : "text-emerald-50 hover:bg-white/[0.12] hover:text-white")}><LayoutDashboard aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} /><span className="min-w-0 leading-5">Dashboard</span></Link>;
        })()}
        <button type="button" aria-expanded={personnelOpen} onClick={() => setPersonnelOpen((open) => !open)} className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", personnelActive ? "bg-white/[0.18] text-white" : "text-emerald-50 hover:bg-white/[0.12] hover:text-white")}>
          <BriefcaseBusiness aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} /><span className="min-w-0 flex-1 leading-5">Kepegawaian</span><ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 transition-transform", personnelOpen && "rotate-180")} />
        </button>
        {personnelOpen && <div className="ml-3 space-y-1 border-l border-amber-200/45 pl-3">
          {personnelNavigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", active ? "bg-white text-emerald-800 shadow-md shadow-emerald-950/20" : "text-emerald-50/90 hover:bg-white/[0.12] hover:text-white")}><Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} /><span className="min-w-0 leading-5">{item.label}</span></Link>;
          })}
        </div>}
        {navigation.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", active ? "bg-white text-emerald-800 shadow-md shadow-emerald-950/20" : "text-emerald-50 hover:bg-white/[0.12] hover:text-white")}>
              <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} /><span className="min-w-0 leading-5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-white/20 p-4">
        <div className="rounded-xl bg-white/10 p-3 text-xs leading-5 text-emerald-100 ring-1 ring-inset ring-white/10"><p className="font-medium text-white">DKPP-Admin</p><p>Ruang kerja administrasi pegawai</p></div>
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-emerald-800/40 lg:block"><SidebarContent /></aside>;
}
