"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LibraryBig, ArrowUpRight } from "lucide-react";
import { useAccess } from "@/components/dashboard/access-context";
import { canAccessPath } from "@/lib/access-control";
import { Input } from "@/components/ui/input";

export function LibraryAdminHeader({ title, description }: { title: string; description: string }) {
  const path = usePathname(), access = useAccess();
  return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><div className="rounded-xl bg-emerald-100 p-3 text-emerald-800"><LibraryBig className="size-6" /></div><div><p className="text-sm font-medium text-emerald-700">Perpustakaan DKPP</p><h1 className="mt-1 text-2xl font-semibold md:text-3xl">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">{description}</p></div></div><Link href="/perpustakaan" target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">Halaman publik<ArrowUpRight className="size-4" /></Link></div>
    <nav aria-label="Menu perpustakaan" className="flex gap-2 overflow-x-auto border-b">{[["buku","Daftar Buku"],["pengunjung","Daftar Pengunjung"],["peminjaman","Daftar Peminjaman"]].map(([id,label]) => { const href = `/dashboard/perpustakaan/${id}`; return canAccessPath(access,href) ? <Link key={id} href={href} aria-current={path === href ? "page" : undefined} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${path === href ? "border-emerald-700 text-emerald-800" : "border-transparent text-zinc-500 hover:text-emerald-700"}`}>{label}</Link> : null; })}</nav>
  </div>;
}
export const selectClass = "h-10 w-full min-w-0 rounded-lg border border-input bg-white px-3 text-sm";
export function LibraryField({ label, value, onChange, required = false, type = "text", maxLength = 500, min, disabled = false }: { label: string; value: string | number; onChange: (v: string) => void; required?: boolean; type?: string; maxLength?: number; min?: number | string; disabled?: boolean }) {
  return <label className="grid gap-2 text-sm font-medium">{label}<Input value={value} onChange={e => onChange(e.target.value)} required={required} type={type} maxLength={maxLength} min={min} disabled={disabled} /></label>;
}
export async function libraryRequest(path: string, method: string, values: unknown) {
  const response = await fetch(`/api/library/${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Permintaan gagal. Silakan coba lagi.");
  return result;
}
export function dateLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00Z`)) : "-";
}
