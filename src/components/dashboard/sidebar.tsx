"use client";

import { canAccessPath } from "@/lib/access-control";
import { useAccess } from "@/components/dashboard/access-context";
import Link, { useLinkStatus } from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Archive, Award, BriefcaseBusiness, Building2, Calculator, CalendarDays, ChevronDown, ClipboardList, CloudUpload, FileBarChart2, FileCheck2, FileSignature, FileText, FolderOpen, History, House, LayoutDashboard, ListTree, LoaderCircle, Network, PanelLeftClose, PanelLeftOpen, Scale, ScrollText, Send, type LucideIcon, UserRound, UsersRound, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const personnelNavigation = [
  { label: "Daftar Pegawai", href: "/dashboard/pegawai", icon: UsersRound },
  { label: "Daftar Unit Organisasi", href: "/dashboard/unit-organisasi", icon: Building2 },
  { label: "Daftar Jabatan", href: "/dashboard/jabatan", icon: Network },
  { label: "Daftar Plt.", href: "/dashboard/daftar-plt", icon: CalendarDays },
  { label: "Daftar Hukdis", href: "/dashboard/hukdis", icon: Scale },
  { label: "Surat HUKDIS & HUKDA", href: "/dashboard/surat-hukdis-hukda", icon: FileCheck2 },
  { label: "DPCP", href: "/dashboard/dpcp", icon: ScrollText },
  { label: "PAK", href: "/dashboard/pak", icon: Award },
  { label: "SK KGB", href: "/dashboard/kgb", icon: FileSignature },
  { label: "Pembukaan Kerjaku", href: "/dashboard/pembukaan-kerjaku", icon: FileSignature },
];

const generalNavigation = [
  { label: "Daftar WFH/WFO", href: "/dashboard/daftar-wfh", icon: CalendarDays },
  { label: "Laporan Pegawai WFH/WFO", href: "/dashboard/laporan-pegawai-wfh-wfo", icon: FileBarChart2 },
  { label: "Surat Tugas WFH", href: "/dashboard/wfh", icon: House },
  { label: "Laporan WFH", href: "/dashboard/laporan-wfh", icon: ClipboardList },
];

const correspondenceNavigation = [
  { label: "Klasifikasi Surat", href: "/dashboard/klasifikasi-surat", icon: ListTree },
  { label: "Arsip Dinas", href: "/dashboard/arsip-dinas", icon: Archive },
  { label: "Surat Pengantar", href: "/dashboard/surat-pengantar", icon: Send },
  { label: "Surat Perbantuan", href: "/dashboard/surat-perbantuan", icon: FileSignature },
  { label: "Surat Lupa Absen Pulang", href: "/dashboard/surat-lupa-absen-pulang", icon: FileSignature },
];

const navigation = [
  { label: "Manajemen User", href: "/dashboard/manajemen-user", icon: UsersRound },
  { label: "Backup ke Lokal", href: "/dashboard/backup-lokal", icon: Archive },
  { label: "Backup Google Drive", href: "/dashboard/backup", icon: CloudUpload },
  { label: "Log Audit Perubahan Data", href: "/dashboard/log-audit", icon: History },
  { label: "Profil Saya", href: "/dashboard/profile", icon: UserRound },
];

function NavigationIcon({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  const { pending } = useLinkStatus();

  return pending
    ? <LoaderCircle aria-hidden="true" className={`${className} animate-spin`} />
    : <Icon aria-hidden="true" className={className} strokeWidth={1.75} />;
}

type NavigationItem = { label: string; href: string; icon: LucideIcon };
function CompactGroup({ label, icon: Icon, items }: { label: string; icon: LucideIcon; items: NavigationItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = items.some(item => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button variant="ghost" size="icon" title={label} aria-label={label} className={cn("size-12 rounded-xl text-emerald-50 hover:bg-white/15 hover:text-white", active && "bg-white/20 text-white")} />}><Icon aria-hidden="true" className="size-5" /></PopoverTrigger>
    <PopoverContent side="right" align="start" sideOffset={12} className="w-72 max-w-[calc(100vw-6rem)]">
      <PopoverTitle className="px-2 py-1">{label}</PopoverTitle>
      <div className="max-h-[70vh] space-y-1 overflow-y-auto">{items.map(item => {
        const selected = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={selected ? "page" : undefined} className={cn("flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-emerald-600", selected ? "bg-emerald-100 font-medium text-emerald-900" : "hover:bg-muted")}><NavigationIcon icon={item.icon} className="size-4 shrink-0" /><span>{item.label}</span></Link>;
      })}</div>
    </PopoverContent>
  </Popover>;
}
function CompactSidebar({ onToggle }: { onToggle?: () => void }) {
  const access = useAccess();
  const allowed = (item: NavigationItem) => canAccessPath(access, item.href);
  const personnelItems = personnelNavigation.filter(allowed);
  const generalItems = generalNavigation.filter(allowed);
  const correspondenceItems = correspondenceNavigation.filter(allowed);
  const navigationItems = navigation.filter(allowed);
  const pathname = usePathname();
  return <div className="flex h-full flex-col bg-gradient-to-b from-emerald-600 via-green-700 to-sky-700 text-emerald-50">
    <div className="flex h-20 shrink-0 items-center justify-center border-b border-white/20 bg-white/[0.08]" title="DKPP-Admin · Administrasi DKPP"><span className="grid size-12 place-items-center rounded-xl bg-white p-1 shadow-lg ring-1 ring-amber-200/70"><Image src="/dkpp-admin-logo.png" alt="DKPP-Admin" width={44} height={44} className="size-11 object-contain" priority /></span></div>
    <nav aria-label="Menu utama" className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto py-4">
      <Button type="button" variant="ghost" size="icon" aria-label="Perbesar sidebar" title="Perbesar sidebar" aria-expanded={false} aria-controls="desktop-sidebar" onClick={onToggle} className="mb-2 size-12 text-white hover:bg-white/15 hover:text-white"><PanelLeftOpen className="size-5" /></Button>
{canAccessPath(access, "/dashboard") &&       <Link href="/dashboard" title="Dashboard" aria-label="Dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined} className={cn("grid size-12 shrink-0 place-items-center rounded-xl focus-visible:outline-2 focus-visible:outline-amber-300", pathname === "/dashboard" ? "bg-white text-emerald-800" : "hover:bg-white/15")}><NavigationIcon icon={LayoutDashboard} className="size-5" /></Link>}
      {personnelItems.length > 0 && <CompactGroup label="Kepegawaian" icon={BriefcaseBusiness} items={personnelItems} />}
      {generalItems.length > 0 && <CompactGroup label="Umum" icon={FolderOpen} items={generalItems} />}
      {correspondenceItems.length > 0 && <CompactGroup label="Persuratan" icon={FileText} items={correspondenceItems} />}
      {canAccessPath(access, "/dashboard/pembuatan-kak") && <CompactGroup label="Perencanaan" icon={ClipboardList} items={[{ label: "Pembuatan PO dan KAK", href: "/dashboard/pembuatan-kak", icon: FileSignature }]} />}
      {canAccessPath(access, "/dashboard/simulasi-gaji-pns") && <CompactGroup label="Keuangan" icon={Wallet} items={[{ label: "Simulasi Gaji PNS", href: "/dashboard/simulasi-gaji-pns", icon: Calculator }]} />}
      {navigationItems.map(item => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <Link key={item.href} href={item.href} title={item.label} aria-label={item.label} aria-current={active ? "page" : undefined} className={cn("grid size-12 shrink-0 place-items-center rounded-xl focus-visible:outline-2 focus-visible:outline-amber-300", active ? "bg-white text-emerald-800" : "hover:bg-white/15")}><NavigationIcon icon={item.icon} className="size-5" /></Link>;
      })}
    </nav>
    <div className="shrink-0 border-t border-white/20 py-4 text-center text-[10px] font-medium" title="DKPP-Admin · Administrasi DKPP">DKPP<span className="sr-only">-Admin · Administrasi DKPP</span></div>
  </div>;
}

export function SidebarContent({ onNavigate, collapsed = false, onToggle }: { onNavigate?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  const access = useAccess();
  const allowed = (item: NavigationItem) => canAccessPath(access, item.href);
  const personnelItems = personnelNavigation.filter(allowed);
  const generalItems = generalNavigation.filter(allowed);
  const correspondenceItems = correspondenceNavigation.filter(allowed);
  const navigationItems = navigation.filter(allowed);
  const pathname = usePathname();
  const personnelActive = personnelNavigation.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const generalActive = generalNavigation.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const correspondenceActive = correspondenceNavigation.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const [personnelOpen, setPersonnelOpen] = useState(personnelActive);
  const [generalOpen, setGeneralOpen] = useState(generalActive);
  const [correspondenceOpen, setCorrespondenceOpen] = useState(correspondenceActive);
  const planningActive = pathname.startsWith("/dashboard/pembuatan-kak");
  const [planningOpen, setPlanningOpen] = useState(planningActive);
  const financeActive = pathname.startsWith("/dashboard/simulasi-gaji-pns");
  const [financeOpen, setFinanceOpen] = useState(financeActive);
  if (collapsed) return <CompactSidebar onToggle={onToggle} />;
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-emerald-600 via-green-700 to-sky-700 text-emerald-50">
      <div className="flex h-20 shrink-0 items-center gap-3 border-b border-white/20 bg-white/[0.08] px-3.5">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white p-1 shadow-lg shadow-emerald-950/25 ring-1 ring-amber-200/70"><Image src="/dkpp-admin-logo.png" alt="" width={52} height={52} className="size-12 object-contain" priority /></span>
        <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold leading-5 text-white">DKPP-Admin</p><p className="truncate text-[11px] text-emerald-100/85">Administrasi DKPP</p></div>
        {onToggle && <Button type="button" variant="ghost" size="icon" onClick={onToggle} aria-label="Perkecil sidebar" title="Perkecil sidebar" aria-expanded={true} aria-controls="desktop-sidebar" className="size-8 shrink-0 text-white hover:bg-white/15 hover:text-white"><PanelLeftClose className="size-4" /></Button>}
        {onNavigate && <Button variant="ghost" size="icon" onClick={onNavigate} aria-label="Tutup menu" className="size-10 shrink-0 text-white/85 hover:bg-white/15 hover:text-white"><X className="size-4" /></Button>}
      </div>
      <nav aria-label="Menu utama" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-6">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">Menu utama</p>
        {canAccessPath(access, "/dashboard") && (() => {
          const active = pathname === "/dashboard";
          return <Link href="/dashboard" onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", active ? "bg-white text-emerald-800 shadow-md shadow-emerald-950/20" : "text-emerald-50 hover:bg-white/[0.12] hover:text-white")}><NavigationIcon icon={LayoutDashboard} className="size-5 shrink-0" /><span className="min-w-0 leading-5">Dashboard</span></Link>;
        })()}
        {personnelItems.length > 0 && <button type="button" aria-expanded={personnelOpen} onClick={() => setPersonnelOpen((open) => !open)} className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", personnelActive ? "bg-white/[0.18] text-white" : "text-emerald-50 hover:bg-white/[0.12] hover:text-white")}>
          <BriefcaseBusiness aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} /><span className="min-w-0 flex-1 leading-5">Kepegawaian</span><ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 transition-transform", personnelOpen && "rotate-180")} />
        </button>}
        {personnelItems.length > 0 && personnelOpen && <div className="ml-3 space-y-1 border-l border-amber-200/45 pl-3">
          {personnelItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", active ? "bg-white text-emerald-800 shadow-md shadow-emerald-950/20" : "text-emerald-50/90 hover:bg-white/[0.12] hover:text-white")}><NavigationIcon icon={Icon} className="size-4 shrink-0" /><span className="min-w-0 leading-5">{item.label}</span></Link>;
          })}
        </div>}
        {generalItems.length > 0 && <button type="button" aria-expanded={generalOpen} onClick={() => setGeneralOpen((open) => !open)} className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", generalActive ? "bg-white/[0.18] text-white" : "text-emerald-50 hover:bg-white/[0.12] hover:text-white")}>
          <FolderOpen aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} /><span className="min-w-0 flex-1 leading-5">Umum</span><ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 transition-transform", generalOpen && "rotate-180")} />
        </button>}
        {generalItems.length > 0 && generalOpen && <div className="ml-3 space-y-1 border-l border-amber-200/45 pl-3">
          {generalItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", active ? "bg-white text-emerald-800 shadow-md shadow-emerald-950/20" : "text-emerald-50/90 hover:bg-white/[0.12] hover:text-white")}><NavigationIcon icon={Icon} className="size-4 shrink-0" /><span className="min-w-0 leading-5">{item.label}</span></Link>;
          })}
        </div>}
        {correspondenceItems.length > 0 && <button type="button" aria-expanded={correspondenceOpen} onClick={() => setCorrespondenceOpen((open) => !open)} className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", correspondenceActive ? "bg-white/[0.18] text-white" : "text-emerald-50 hover:bg-white/[0.12] hover:text-white")}>
          <FileText aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} /><span className="min-w-0 flex-1 leading-5">Persuratan</span><ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 transition-transform", correspondenceOpen && "rotate-180")} />
        </button>}
        {correspondenceItems.length > 0 && correspondenceOpen && <div className="ml-3 space-y-1 border-l border-amber-200/45 pl-3">
          {correspondenceItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", active ? "bg-white text-emerald-800 shadow-md shadow-emerald-950/20" : "text-emerald-50/90 hover:bg-white/[0.12] hover:text-white")}><NavigationIcon icon={Icon} className="size-4 shrink-0" /><span className="min-w-0 leading-5">{item.label}</span></Link>;
          })}
        </div>}
        {canAccessPath(access, "/dashboard/pembuatan-kak") && <button type="button" aria-expanded={planningOpen} onClick={() => setPlanningOpen((open) => !open)} className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", planningActive ? "bg-white/[0.18] text-white" : "text-emerald-50 hover:bg-white/[0.12] hover:text-white")}>
          <ClipboardList aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} /><span className="min-w-0 flex-1 leading-5">Perencanaan</span><ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 transition-transform", planningOpen && "rotate-180")} />
        </button>}
        {canAccessPath(access, "/dashboard/pembuatan-kak") && planningOpen && <div className="ml-3 border-l border-amber-200/45 pl-3"><Link href="/dashboard/pembuatan-kak" onClick={onNavigate} aria-current={planningActive ? "page" : undefined} className={cn("flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", planningActive ? "bg-white text-emerald-800 shadow-md shadow-emerald-950/20" : "text-emerald-50/90 hover:bg-white/[0.12] hover:text-white")}><NavigationIcon icon={FileSignature} className="size-4 shrink-0" /><span>Pembuatan PO dan KAK</span></Link></div>}
        {canAccessPath(access, "/dashboard/simulasi-gaji-pns") && <button type="button" aria-expanded={financeOpen} onClick={() => setFinanceOpen(open => !open)} className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", financeActive ? "bg-white/[0.18] text-white" : "text-emerald-50 hover:bg-white/[0.12] hover:text-white")}>
          <Wallet aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} /><span className="min-w-0 flex-1 leading-5">Keuangan</span><ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 transition-transform", financeOpen && "rotate-180")} />
        </button>}
        {canAccessPath(access, "/dashboard/simulasi-gaji-pns") && financeOpen && <div className="ml-3 border-l border-amber-200/45 pl-3"><Link href="/dashboard/simulasi-gaji-pns" onClick={onNavigate} aria-current={financeActive ? "page" : undefined} className={cn("flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", financeActive ? "bg-white text-emerald-800 shadow-md shadow-emerald-950/20" : "text-emerald-50/90 hover:bg-white/[0.12] hover:text-white")}><NavigationIcon icon={Calculator} className="size-4 shrink-0" /><span>Simulasi Gaji PNS</span></Link></div>}
        {navigationItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300", active ? "bg-white text-emerald-800 shadow-md shadow-emerald-950/20" : "text-emerald-50 hover:bg-white/[0.12] hover:text-white")}>
              <NavigationIcon icon={Icon} className="size-5 shrink-0" /><span className="min-w-0 leading-5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-white/20 p-4">
        <div className="rounded-xl bg-white/10 p-3 text-xs leading-5 text-emerald-100 ring-1 ring-inset ring-white/10"><p className="font-medium text-white">DKPP-Admin</p><p>Administrasi DKPP</p></div>
      </div>
    </div>
  );
}

export function DesktopSidebar({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  return <aside id="desktop-sidebar" className={cn("fixed inset-y-0 left-0 z-30 hidden border-r border-emerald-800/40 transition-[width] duration-200 motion-reduce:transition-none lg:block", collapsed ? "w-20" : "w-64")}><SidebarContent collapsed={collapsed} onToggle={onToggle} /></aside>;
}
