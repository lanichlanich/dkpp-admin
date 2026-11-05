"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Download, Search } from "lucide-react";
import Link from "next/link";
import { formatIndonesianDate } from "@/lib/kgb";
import { jakartaToday } from "@/lib/plt-dates";
import { KGB_REMINDER_DAYS, kgbDaysRemaining, kgbReminderStatus } from "@/lib/kgb-reminder-dates";
import type { KgbReminder } from "@/lib/kgb-reminders";
import { TableHorizontalScroll } from "@/components/ui/table-horizontal-scroll";

export function KgbReminders({ reminders, initialToday, compact = false, downloadMode = "kgb" }: { reminders: KgbReminder[]; initialToday: string; compact?: boolean; downloadMode?: "kgb" | "pegawai" }) {
  const [query, setQuery] = useState(""), [page, setPage] = useState(1), [today, setToday] = useState(initialToday);
  useEffect(() => { const timer = setInterval(() => setToday(jakartaToday()), 60_000); return () => clearInterval(timer); }, []);
  const rows = useMemo(() => reminders.map(r => ({ ...r, daysRemaining: kgbDaysRemaining(r.nextTmt, today) })).filter(r => (!compact || r.daysRemaining <= KGB_REMINDER_DAYS) && `${r.employeeName} ${r.employeeNip}`.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID"))), [reminders, today, compact, query]);
  const size = compact ? 5 : 10, pages = Math.max(1, Math.ceil(rows.length / size)), active = Math.min(page, pages);
  return <section aria-label="Pengingat KGB berikutnya" className="min-w-0 space-y-4 overflow-hidden rounded-xl border bg-white py-4">
    <header className="px-4"><h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarClock className="size-5 text-indigo-600" />Pengingat KGB Berikutnya</h2><p className="mt-1 text-xs leading-5 text-zinc-500">TMT SK KGB yang sudah ditandatangani + 2 tahun. Pengingat mulai {KGB_REMINDER_DAYS} hari sebelum jatuh tempo, untuk PNS aktif.</p></header>
    {!compact && <label className="mx-4 flex items-center gap-2 rounded-lg border px-3"><Search className="size-4 text-zinc-400" /><input aria-label="Cari pengingat KGB" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Cari nama atau NIP..." className="h-10 min-w-0 w-full bg-transparent text-sm outline-none" /></label>}
    {rows.length ? <TableHorizontalScroll label="Pengingat KGB" aria-label="Jadwal KGB berikutnya"><thead><tr className="border-y bg-indigo-50 text-left text-xs text-indigo-950">{["Pegawai", "TMT KGB sekarang", "KGB berikutnya", "Status", "SK bertanda tangan"].map(t => <th key={t} className="px-4 py-3 font-semibold">{t}</th>)}</tr></thead><tbody>{rows.slice((active - 1) * size, active * size).map(r => {
      const status = kgbReminderStatus(r.daysRemaining), color = status === "overdue" ? "bg-red-50 text-red-800" : status === "due" || status === "upcoming" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800";
      const label = status === "overdue" ? `Terlewat ${-r.daysRemaining} hari` : status === "due" ? "Jatuh tempo hari ini" : status === "upcoming" ? `${r.daysRemaining} hari lagi` : "Terjadwal";
      const href = downloadMode === "kgb" ? `/api/kgb/${r.documentId}/signed/${r.signedId}` : `/api/employees/${r.employeeNip}/documents/kgb-${r.signedId}/download`;
      return <tr key={r.employeeNip} className="border-b text-sm"><td className="px-4 py-3"><p className="font-medium">{r.employeeName}</p><p className="text-xs text-zinc-500">{r.employeeNip}</p></td><td className="px-4 py-3">{formatIndonesianDate(r.currentTmt)}</td><td className="px-4 py-3 font-medium">{formatIndonesianDate(r.nextTmt)}</td><td className="px-4 py-3"><span className={`inline-block whitespace-nowrap rounded-full px-2 py-1 text-xs ${color}`}>{label}</span></td><td className="px-4 py-3"><a href={href} className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:underline"><Download className="size-3.5" />Unduh SK TTD</a></td></tr>;
    })}</tbody></TableHorizontalScroll> : <p className="px-4 py-3 text-sm text-zinc-500">{compact ? "Tidak ada KGB yang jatuh tempo dalam 90 hari atau sudah terlewat." : reminders.length ? "Pengingat tidak ditemukan." : "Belum ada TMT dari SK KGB bertanda tangan. Upload SK TTD dan lengkapi TMT pada dokumen tersebut."}</p>}
    <footer className="flex flex-wrap items-center justify-between gap-2 px-4 text-xs text-zinc-500"><span>{rows.length} jadwal · Halaman {active} dari {pages}</span><div className="flex gap-2"><button type="button" disabled={active <= 1} onClick={() => setPage(active - 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Sebelumnya</button><button type="button" disabled={active >= pages} onClick={() => setPage(active + 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Berikutnya</button>{compact && downloadMode === "kgb" && <Link href="/dashboard/kgb" className="rounded border border-indigo-200 px-3 py-1.5 text-indigo-700">Semua jadwal KGB</Link>}</div></footer>
  </section>;
}
