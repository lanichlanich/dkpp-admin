"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Search, Users, CalendarClock, TriangleAlert, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import source from "@/data/retirement-position-map-2026.json";
import { buildRetirementProjection, POSITION_KINDS, type ProjectionEmployee, type ProjectionRow, type ProjectedEmployee } from "@/lib/retirement-projection";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableHorizontalScroll } from "@/components/ui/table-horizontal-scroll";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const colors: Record<string, string> = { Fungsional: "bg-violet-100 text-violet-800", Pelaksana: "bg-sky-100 text-sky-800", Struktural: "bg-amber-100 text-amber-900" };
const selectClass = "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm";
const date = (value: string | null) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "Belum diketahui";
const KindBadge = ({ kind }: { kind: string }) => <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${colors[kind] ?? "bg-zinc-100 text-zinc-700"}`}>{kind}</span>;
const highlightedRow = "[&>td]:bg-[#fed7aa] hover:[&>td]:bg-[#fed7aa]";
const checkboxClass = "size-4 cursor-pointer accent-orange-600";

export function RetirementProjectionPanel({ employees, today }: { employees: ProjectionEmployee[]; today: string }) {
  const defaultYear = Number(today.slice(0, 4)) + 1;
  const [startYear, setStartYear] = useState(defaultYear), [kind, setKind] = useState("all"), [unit, setUnit] = useState(""), [asn, setAsn] = useState("all"), [search, setSearch] = useState("");
  const [tab, setTab] = useState("recap"), [page, setPage] = useState(1), [sort, setSort] = useState("source"), [busy, setBusy] = useState("");
  const [detail, setDetail] = useState<ProjectionRow | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(() => new Set());
  const filters = useMemo(() => ({ startYear, kind, unit, asn, search }), [startYear, kind, unit, asn, search]);
  const projection = useMemo(() => buildRetirementProjection(source.positions, employees, filters, today), [employees, filters, today]);
  const units = useMemo(() => [...new Set([...source.positions.map(row => row.unit), ...employees.map(e => e.unit)])].sort((a, b) => a.localeCompare(b, "id")), [employees]);
  const rows = useMemo(() => [...projection.rows].sort((a, b) => sort === "retiring" ? b.totalRetirements - a.totalRetirements || a.name.localeCompare(b.name, "id")
    : sort === "name" ? a.name.localeCompare(b.name, "id") || a.unit.localeCompare(b.unit, "id")
    : sort === "unit" ? a.unit.localeCompare(b.unit, "id") || a.name.localeCompare(b.name, "id") : source.positions.findIndex(r => r.id === a.id) - source.positions.findIndex(r => r.id === b.id)), [projection.rows, sort]);
  const people = useMemo(() => [...(tab === "review" ? projection.review : projection.retirees)].sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "id")
    : sort === "unit" ? a.mappedUnit.localeCompare(b.mappedUnit, "id") || a.name.localeCompare(b.name, "id")
    : (a.retirementTmt ?? "9999").localeCompare(b.retirementTmt ?? "9999") || a.name.localeCompare(b.name, "id")), [projection.retirees, projection.review, sort, tab]);
  const total = tab === "recap" ? rows.length : people.length, pages = Math.max(1, Math.ceil(total / 20)), current = Math.min(page, pages);
  const last = projection.years[4], first = projection.years[0];
  const pageRows = rows.slice((current - 1) * 20, current * 20);
  const pageSelected = pageRows.filter(row => highlightedIds.has(row.id)).length;
  const pdfParams = new URLSearchParams({ format: "pdf", startYear: String(startYear), kind, unit, asn, search });
  if (highlightedIds.size) pdfParams.set("highlight", [...highlightedIds].join(","));
  function toggleHighlight(id: string, checked: boolean) {
    setHighlightedIds(previous => { const next = new Set(previous); if (checked) next.add(id); else next.delete(id); return next; });
  }
  function highlightRows(ids: string[], checked = true) {
    setHighlightedIds(previous => { const next = new Set(previous); for (const id of ids) { if (checked) next.add(id); else next.delete(id); } return next; });
  }
  function update(action: () => void) { action(); setPage(1); }
  async function download(format: "xlsx") {
    setBusy(format);
    try {
      const params = new URLSearchParams({ format, startYear: String(startYear), kind, unit, asn, search });
      const response = await fetch(`/api/retirement-projection/export?${params}`);
      if (response.status !== 200) throw new Error((await response.json().catch(() => null))?.message ?? "Dokumen belum diterima. Silakan unduh kembali.");
      const blob = await response.blob();
      if (!blob.size) throw new Error("Dokumen yang diterima kosong. Silakan unduh kembali.");
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = `Proyeksi-Pensiun-DKPP-${first}-${last}.${format}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unduhan gagal."); }
    finally { setBusy(""); }
  }
  function employeeTable(items: ProjectedEmployee[], review: boolean) {
    return <TableHorizontalScroll label={review ? "verifikasi proyeksi" : "pegawai pensiun"}><TableHeader><TableRow>
      <TableHead>Pegawai / NIP</TableHead><TableHead>Jabatan / unit penempatan</TableHead><TableHead>Jenis</TableHead><TableHead>BUP</TableHead><TableHead>TMT pensiun</TableHead><TableHead>Keterangan</TableHead>
    </TableRow></TableHeader><TableBody>{items.map(e => <TableRow key={e.nip} data-highlighted={!!e.requirementId && highlightedIds.has(e.requirementId)} className={e.requirementId && highlightedIds.has(e.requirementId) ? highlightedRow : undefined}>
      <TableCell><p className="font-medium">{e.name}</p><p className="text-xs tabular-nums text-zinc-500">{e.nip}</p><span className="text-xs text-zinc-500">{e.asnType}</span></TableCell>
      <TableCell className="min-w-64 whitespace-normal"><p>{e.position}</p><p className="mt-1 text-xs text-zinc-500">{e.mappedUnit}</p></TableCell>
      <TableCell><KindBadge kind={e.kind} /></TableCell><TableCell>{e.retirementAge === null ? "Perlu ditentukan" : `${e.retirementAge} tahun`}</TableCell>
      <TableCell className="whitespace-nowrap font-medium text-indigo-700">{date(e.retirementTmt)}</TableCell>
      <TableCell className="min-w-64 whitespace-normal text-xs leading-5 text-zinc-600">{e.issues.length ? e.issues.join("; ") : "Terpetakan"}{e.asnType !== "PNS" && <p className="mt-1 text-amber-700">BUP jabatan; bukan akhir kontrak PPPK.</p>}</TableCell>
    </TableRow>)}{!items.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-zinc-500">Tidak ada data dalam cakupan ini.</TableCell></TableRow>}</TableBody></TableHorizontalScroll>;
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
      <div><p className="font-semibold text-indigo-950">Periode {first}–{last}</p><p className="mt-1 text-xs leading-5 text-indigo-800">Dasar kebutuhan: peta jabatan 2026 · Data pegawai aktif per {date(today)} · Unduhan memuat seluruh hasil filter.</p></div>
      <div className="flex gap-2"><Button onClick={() => download("xlsx")} disabled={!!busy} className="bg-emerald-700 hover:bg-emerald-800">{busy === "xlsx" ? <LoaderCircle className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}Excel</Button><a download href={`/api/retirement-projection/export?${pdfParams}`} className={buttonVariants({ className: "bg-rose-700 hover:bg-rose-800" })}><FileText className="size-4" />PDF</a></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      { label: "Kebutuhan peta jabatan", value: projection.required, icon: Users, text: "Sesuai cakupan jabatan dan unit" },
      { label: "Pegawai aktif", value: projection.employees.length, icon: Users, text: `${projection.mappedActive} sudah cocok dengan peta` },
      { label: "Proyeksi pensiun 5 tahun", value: projection.retirees.length, icon: CalendarClock, text: `${first}–${last}, termasuk belum terpetakan` },
      { label: "Perlu verifikasi", value: projection.review.length, icon: TriangleAlert, text: `${projection.unmapped} belum terpetakan · ${projection.unknownDates} TMT belum diketahui` },
    ].map(card => <div key={card.label} className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2 text-sm text-zinc-600">{card.label}<card.icon className="size-4 text-indigo-500" /></div><p className="mt-2 text-3xl font-semibold tabular-nums">{card.value}</p><p className="mt-2 text-xs leading-5 text-zinc-500">{card.text}</p></div>)}</div>
    <div className="grid gap-3 md:grid-cols-3">{projection.summaries.map(group => <button key={group.kind} type="button" onClick={() => update(() => setKind(kind === group.kind ? "all" : group.kind))} className={`rounded-xl border p-4 text-left transition hover:shadow-md ${kind === group.kind ? "border-indigo-400 ring-2 ring-indigo-100" : "bg-white"}`}>
      <KindBadge kind={group.kind} /><div className="mt-3 flex items-end gap-2"><strong className="text-2xl">{group.retirements.reduce((a, b) => a + b, 0)}</strong><span className="pb-1 text-sm text-zinc-500">pegawai diproyeksikan pensiun</span></div>
      <p className="mt-2 text-xs text-zinc-500">Kebutuhan {group.required} · Aktif {group.active} · Terpetakan {group.mappedActive}</p>
    </button>)}</div>
    <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Pensiun per tahun</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{projection.years.map((year, i) => <div key={year} className="rounded-lg bg-zinc-50 p-3"><p className="text-sm text-zinc-500">{year}</p><p className="mt-1 text-2xl font-semibold">{projection.retirees.filter(e => e.retirementTmt?.startsWith(String(year))).length}</p><div className="mt-2 space-y-1">{projection.summaries.map(g => <p key={g.kind} className="flex justify-between gap-2 text-xs text-zinc-600"><span>{g.kind}</span><strong>{g.retirements[i]}</strong></p>)}</div></div>)}</div></section>
    <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
      <label className="text-xs font-medium text-zinc-600">Tahun awal<select aria-label="Tahun awal proyeksi" className={`${selectClass} mt-1.5`} value={startYear} onChange={e => update(() => setStartYear(Number(e.target.value)))}>{Array.from({ length: 96 }, (_, i) => 2000 + i).map(year => <option key={year} value={year}>{year}–{year + 4}</option>)}</select></label>
      <label className="text-xs font-medium text-zinc-600">Jenis jabatan<select aria-label="Jenis jabatan proyeksi" className={`${selectClass} mt-1.5`} value={kind} onChange={e => update(() => setKind(e.target.value))}><option value="all">Semua jenis</option>{POSITION_KINDS.map(k => <option key={k}>{k}</option>)}</select></label>
      <label className="text-xs font-medium text-zinc-600">Unit penempatan<select aria-label="Unit proyeksi" className={`${selectClass} mt-1.5`} value={unit} onChange={e => update(() => setUnit(e.target.value))}><option value="">Semua unit</option>{units.map(u => <option key={u}>{u}</option>)}</select></label>
      <label className="text-xs font-medium text-zinc-600">Jenis ASN<select aria-label="Jenis ASN proyeksi" className={`${selectClass} mt-1.5`} value={asn} onChange={e => update(() => setAsn(e.target.value))}>{["all", "PNS", "PPPK", "PPPK PW"].map(a => <option key={a} value={a}>{a === "all" ? "Semua ASN" : a}</option>)}</select></label>
      <label className="text-xs font-medium text-zinc-600">Pencarian<div className="relative mt-1.5"><Search className="absolute top-3 left-3 size-4 text-zinc-400" /><Input aria-label="Cari proyeksi" value={search} maxLength={150} onChange={e => update(() => setSearch(e.target.value))} placeholder="Jabatan, unit, nama, NIP…" className="h-10 pl-9" /></div></label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
      <div><p className="flex items-center gap-2 text-sm font-semibold text-orange-950"><span aria-hidden="true" className="size-4 rounded border border-orange-400 bg-[#fed7aa]" />Penanda oranye PDF</p><p className="mt-1 text-xs leading-5 text-orange-900">Centang jabatan pada rekap untuk menandai baris PDF. Unduhan tetap mengikuti filter.</p><p role="status" className="mt-1 text-xs text-orange-900">{highlightedIds.size} jabatan ditandai · {rows.filter(row => highlightedIds.has(row.id)).length} pada filter ini</p></div>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="border-orange-300 bg-white text-orange-900" disabled={!rows.length} onClick={() => highlightRows(rows.map(row => row.id))}>Tandai semua hasil</Button><Button type="button" variant="outline" className="border-orange-300 bg-white text-orange-900" disabled={!highlightedIds.size} onClick={() => setHighlightedIds(new Set())}>Hapus tanda</Button></div>
    </div>
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div className="flex flex-wrap gap-2">{[["recap", "Rekap jabatan"], ["retirees", "Pegawai pensiun"], ["review", "Perlu verifikasi"]].map(([value, label]) => <Button key={value} variant={tab === value ? "default" : "outline"} onClick={() => update(() => setTab(value))}>{label}</Button>)}</div>
        <label className="flex items-center gap-2 text-xs text-zinc-500">Urutkan<select aria-label="Urutkan proyeksi" value={sort} onChange={e => update(() => setSort(e.target.value))} className="h-9 rounded-lg border bg-white px-2"><option value="source">{tab === "recap" ? "Urutan peta jabatan" : "TMT terdekat"}</option><option value="name">Nama A–Z</option><option value="unit">Unit A–Z</option>{tab === "recap" && <option value="retiring">Pensiun terbanyak</option>}</select></label>
      </div>
      {tab === "recap" ? <TableHorizontalScroll label="rekap proyeksi pensiun"><TableHeader><TableRow><TableHead className="w-12 text-center"><input type="checkbox" aria-label="Tandai semua jabatan pada halaman ini" className={checkboxClass} checked={!!pageRows.length && pageSelected === pageRows.length} disabled={!pageRows.length} ref={node => { if (node) node.indeterminate = pageSelected > 0 && pageSelected < pageRows.length; }} onChange={event => highlightRows(pageRows.map(row => row.id), event.target.checked)} /></TableHead><TableHead>Jabatan / jenis</TableHead><TableHead>Unit penempatan</TableHead><TableHead className="text-center">Kebutuhan</TableHead><TableHead className="text-center">Aktif</TableHead>{projection.years.map(year => <TableHead key={year} className="text-center">Pensiun {year}</TableHead>)}<TableHead className="text-center">Total pensiun</TableHead><TableHead className="text-center">Sisa {last}</TableHead><TableHead className="text-center">Lebih / kurang {last}</TableHead></TableRow></TableHeader><TableBody>
        {pageRows.map(row => <TableRow key={row.id} data-highlighted={highlightedIds.has(row.id)} className={highlightedIds.has(row.id) ? highlightedRow : undefined}><TableCell className="w-12 text-center"><input type="checkbox" aria-label={`Tandai oranye ${row.name} - ${row.unit}`} className={checkboxClass} checked={highlightedIds.has(row.id)} onChange={event => toggleHighlight(row.id, event.target.checked)} /></TableCell><TableCell className="min-w-72 whitespace-normal"><p className="mb-2 font-medium">{row.name}</p><KindBadge kind={row.kind} /><p className="mt-1 text-[11px] text-zinc-400">Hal. {row.page} · No. {row.sourceRow}</p></TableCell><TableCell className="min-w-60 whitespace-normal text-xs leading-5">{row.unit}</TableCell><TableCell className="text-center font-semibold">{row.required}</TableCell><TableCell className="text-center">{row.active}</TableCell>{row.retirements.map((value, i) => <TableCell key={i} className={`text-center ${value ? "bg-rose-50 font-semibold text-rose-700" : "text-zinc-400"}`}>{value}</TableCell>)}<TableCell className="text-center"><button type="button" onClick={() => setDetail(row)} className="rounded-md bg-indigo-50 px-3 py-2 font-semibold text-indigo-700 hover:bg-indigo-100" aria-label={`Detail pensiun ${row.name} ${row.unit}`}>{row.totalRetirements}</button></TableCell><TableCell className="text-center">{row.remaining[4]}</TableCell><TableCell className={`text-center font-semibold ${row.balance[4] < 0 ? "text-rose-700" : row.balance[4] > 0 ? "text-emerald-700" : "text-zinc-500"}`}>{row.balance[4]}</TableCell></TableRow>)}
        {!rows.length && <TableRow><TableCell colSpan={13} className="py-10 text-center text-zinc-500">Tidak ada jabatan sesuai filter.</TableCell></TableRow>}
      </TableBody></TableHorizontalScroll> : employeeTable(people.slice((current - 1) * 20, current * 20), tab === "review")}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-zinc-500"><span>{total ? (current - 1) * 20 + 1 : 0}–{Math.min(current * 20, total)} dari {total} {tab === "recap" ? "penempatan jabatan" : "pegawai"}</span><div className="flex items-center gap-2"><Button aria-label="Halaman sebelumnya proyeksi" variant="outline" size="icon" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft className="size-4" /></Button><span>{current} / {pages}</span><Button aria-label="Halaman berikutnya proyeksi" variant="outline" size="icon" disabled={current === pages} onClick={() => setPage(current + 1)}><ChevronRight className="size-4" /></Button></div></div>
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-950"><p className="font-semibold">Cara membaca proyeksi</p><p>Lebih/kurang = sisa pegawai dikurangi kebutuhan: angka negatif berarti kekurangan, positif berarti kelebihan, dan 0 berarti sesuai. Perhitungan dilakukan per penempatan, tanpa penerimaan/mutasi baru. Total kekurangan dan kelebihan dijumlah terpisah per penempatan. Pegawai dengan TMT belum diketahui tetap dihitung dalam sisa dan perlu diperiksa.</p><p>{projection.beforePeriod} pegawai memiliki TMT sebelum {first}; jumlah tersebut dikurangkan dari sisa akhir tahun. {projection.unmapped} pegawai belum terpetakan tetap ditampilkan pada daftar pensiun/verifikasi, tetapi belum mengisi kebutuhan suatu penempatan.</p><p>PPPK menggunakan proyeksi BUP jabatan, bukan tanggal akhir kontrak. Jika ASN atau pencarian difilter, keterisian dan kekurangan hanya mencerminkan cakupan terpilih. Pencarian nama/NIP pada rekap menampilkan penempatan beserta seluruh pegawai yang mengisinya.</p><p className="mt-1">Dasar: Keputusan Bupati Indramayu {source.decree}, tanggal {date(source.decreeDate)}. Kebutuhan seluruh sumber: 253 pegawai. Excel dan PDF memuat ringkasan tahunan, rekap jabatan, pegawai pensiun, dan data yang perlu diverifikasi.</p></div>
    <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>Detail pegawai pensiun</DialogTitle><DialogDescription>{detail?.name} · {detail?.unit} · {first}–{last}</DialogDescription></DialogHeader>{detail && employeeTable(detail.employees.filter(e => e.retirementTmt && e.retirementTmt >= `${first}-01-01` && e.retirementTmt <= `${last}-12-31`), false)}</DialogContent></Dialog>
  </div>;
}
