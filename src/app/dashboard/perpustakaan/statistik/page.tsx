import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, LibraryBig, BookCheck, UsersRound, BookCopy, ClockAlert } from "lucide-react";
import { requireMenuAccess } from "@/lib/authorization";
import { getLibraryStatistics } from "@/lib/library-statistics";
import { libraryPeriodSchema } from "@/lib/library-statistics-types";
import { jakartaToday } from "@/lib/plt-dates";
import { LibraryAdminHeader } from "@/components/library/admin-shared";
import { LibraryStatisticsChart } from "@/components/library/statistics-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard Statistik Perpustakaan" };
const number = (value: number) => value.toLocaleString("id-ID");
export default async function LibraryStatisticsPage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  await requireMenuAccess("perpustakaan-statistik");
  const query = await searchParams, current = jakartaToday().slice(0,7), parsed = libraryPeriodSchema.safeParse(query.period ?? current);
  const data = await getLibraryStatistics(parsed.success ? parsed.data : current), { snapshot, activity } = data;
  const todayLabel = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${data.today}T00:00:00Z`));
  const cards = [
    { label: "Entri buku", value: snapshot.bookEntries, detail: `${number(snapshot.activeBooks)} aktif · ${number(snapshot.bookEntries - snapshot.activeBooks)} nonaktif`, icon: BookOpen, color: "bg-emerald-50 text-emerald-700" },
    { label: "Total eksemplar", value: snapshot.totalCopies, detail: "Seluruh koleksi aktif dan nonaktif", icon: LibraryBig, color: "bg-blue-50 text-blue-700" },
    { label: "Eksemplar tersedia", value: snapshot.availableCopies, detail: "Dapat dipinjam pada koleksi aktif", icon: BookCheck, color: "bg-teal-50 text-teal-700" },
    { label: "Pengunjung terdaftar", value: snapshot.registeredVisitors, detail: `${number(snapshot.activeVisitors)} aktif · ${number(snapshot.employeeVisitors)} pegawai`, icon: UsersRound, color: "bg-violet-50 text-violet-700" },
    { label: "Eksemplar dipinjam", value: snapshot.borrowedCopies, detail: `${number(snapshot.openLoans)} transaksi belum dikembalikan`, icon: BookCopy, color: "bg-amber-50 text-amber-700" },
    { label: "Transaksi terlambat", value: snapshot.overdueLoans, detail: "Belum kembali, lewat tanggal jatuh tempo", icon: ClockAlert, color: "bg-rose-50 text-rose-700" },
  ];
  return <div className="mx-auto max-w-7xl space-y-6">
    <LibraryAdminHeader title="Dashboard Statistik" description="Pantau koleksi, pengunjung, kunjungan, serta aktivitas peminjaman dan pengembalian Perpustakaan DKPP." />
    <section aria-labelledby="library-current-heading" className="space-y-4"><div><h2 id="library-current-heading" className="text-lg font-semibold">Kondisi perpustakaan saat ini</h2><p className="mt-1 text-sm text-zinc-500">Posisi data {todayLabel} (WIB). Ringkasan ini mengikuti kondisi terbaru.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(card => <Card key={card.label} className="min-w-0 shadow-sm"><CardContent><div className="flex items-start justify-between gap-3"><p className="pt-1 text-sm font-medium text-zinc-600">{card.label}</p><span className={`rounded-xl p-2 ${card.color}`}><card.icon aria-hidden className="size-5" /></span></div><p data-stat={card.label} className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{number(card.value)}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{card.detail}</p></CardContent></Card>)}</div>
    </section>
    <section aria-labelledby="library-period-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 id="library-period-heading" className="text-lg font-semibold">Aktivitas {data.periodLabel}</h2><p className="mt-1 text-sm text-zinc-500">Kunjungan dan transaksi berdasarkan tanggal kegiatan yang tercatat.</p></div>
        <form method="get" className="flex flex-wrap items-end gap-2"><label className="grid gap-1.5 text-xs font-medium text-zinc-600">Periode laporan<Input name="period" aria-label="Periode laporan" type="month" required min="1900-01" max="2199-12" defaultValue={data.period} className="w-44" /></label><Button type="submit">Tampilkan</Button>{data.period !== current && <Link href="/dashboard/perpustakaan/statistik" className="px-2 py-1.5 text-sm font-medium text-emerald-700">Bulan ini</Link>}</form>
      </div>
      {!parsed.success && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Periode tidak valid. Data bulan ini ditampilkan; pilih periode laporan yang benar.</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: "Kunjungan", value: activity.visits, detail: "Jumlah kedatangan tercatat" },
        { label: "Pengunjung unik", value: activity.uniqueVisitors, detail: "Satu orang dihitung sekali per bulan" },
        { label: "Peminjaman", value: activity.loans, detail: `${number(activity.loanCopies)} eksemplar dipinjam` },
        { label: "Pengembalian", value: activity.returns, detail: `${number(activity.returnCopies)} eksemplar dikembalikan` },
      ].map(item => <Card key={item.label} className="min-w-0 border-emerald-100 bg-emerald-50/40 shadow-none"><CardContent><p className="text-sm font-medium text-zinc-600">{item.label}</p><p data-stat={item.label} className="mt-3 text-3xl font-semibold tabular-nums text-emerald-900">{number(item.value)}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</p></CardContent></Card>)}</div>
    </section>
    <Card className="min-w-0"><CardHeader><CardTitle>Tren aktivitas 12 bulan</CardTitle><CardDescription>Berakhir pada {data.periodLabel}. Peminjaman dan pengembalian dihitung per transaksi.</CardDescription></CardHeader><CardContent><LibraryStatisticsChart data={data.months} /></CardContent></Card>
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card className="min-w-0"><CardHeader><CardTitle>Koleksi per kategori</CardTitle><CardDescription>Seluruh koleksi saat ini, termasuk yang nonaktif.</CardDescription></CardHeader><CardContent>{!data.categories.length ? <p className="py-10 text-center text-sm text-zinc-500">Belum ada koleksi buku.</p> : <ul className="max-h-96 space-y-4 overflow-y-auto pr-2">{data.categories.map(category => <li key={category.category}><div className="flex items-start justify-between gap-3 text-sm"><span className="capitalize">{category.category}</span><span className="shrink-0 font-medium tabular-nums">{number(category.copies)} eksemplar</span></div><div aria-hidden className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${data.categories[0].copies ? category.copies / data.categories[0].copies * 100 : 0}%` }} /></div><p className="mt-1 text-xs text-zinc-500">{number(category.entries)} entri buku</p></li>)}</ul>}</CardContent></Card>
      <Card className="min-w-0"><CardHeader><CardTitle>Buku paling banyak dipinjam</CardTitle><CardDescription>{data.periodLabel}, diurutkan berdasarkan jumlah eksemplar.</CardDescription></CardHeader><CardContent>{!data.popularBooks.length ? <p className="rounded-xl bg-zinc-50 px-5 py-12 text-center text-sm text-zinc-500">Belum ada peminjaman pada periode ini.</p> : <ol className="space-y-4">{data.popularBooks.map((book,index) => <li key={book.id} className="flex gap-3 border-b pb-4 last:border-0 last:pb-0"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-xs font-semibold text-emerald-800">{index + 1}</span><div className="min-w-0"><p className="break-words text-sm font-medium leading-6">{book.title}</p><p className="mt-1 break-all font-mono text-xs text-zinc-500">{book.inventoryCode}</p><p className="mt-2 text-xs text-emerald-800">{number(book.copies)} eksemplar · {number(book.loans)} transaksi</p></div></li>)}</ol>}</CardContent></Card>
    </div>
  </div>;
}
