"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Eye, List, LoaderCircle, RefreshCw, Save, Search, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { buildPositionMapPages, currentPositionMapStaff, positionMapHierarchy, positionMapIsUptd, positionMapPlanSchema, positionMapSummary, type PositionMapPlan, type PositionMapRecord } from "@/lib/position-map-model";
import { PositionMapDiagram } from "@/components/employees/position-map-diagram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableHorizontalScroll } from "@/components/ui/table-horizontal-scroll";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Staff = ReturnType<typeof currentPositionMapStaff>;
type Draft = Record<string, { required: string; staffed: string }>;
const toDraft = (plan: PositionMapPlan): Draft => Object.fromEntries(Object.entries(plan.positions).map(([id, row]) => [id, { required: String(row.required), staffed: String(row.staffed) }]));
const selectClass = "h-10 min-w-0 w-full rounded-lg border border-input bg-white px-3 text-sm dark:bg-zinc-950";
const rows = positionMapHierarchy.positions.map((node, i) => ({ ...node.position, depth: node.depth, index: i + 1 }));
const unitOptions = [...new Set(rows.map(row => row.unit))].sort((a, b) => a.localeCompare(b, "id"));
const colors: Record<string, string> = { Fungsional: "bg-violet-100 text-violet-800", Pelaksana: "bg-sky-100 text-sky-800", Struktural: "bg-emerald-100 text-emerald-800" };

export function PositionMapEditor({ record: initial, staff: initialStaff, today: initialToday }: { record: PositionMapRecord; staff: Staff; today: string }) {
  const [record, setRecord] = useState(initial), [draft, setDraft] = useState(() => toDraft(initial.plan));
  const [staff, setStaff] = useState(initialStaff), [today, setToday] = useState(initialToday);
  const [search, setSearch] = useState(""), [scope, setScope] = useState("all"), [unit, setUnit] = useState(""), [kind, setKind] = useState("all"), [page, setPage] = useState(1);
  const [tab, setTab] = useState("data"), [zoom, setZoom] = useState(100), [busy, setBusy] = useState("");
  const [dialog, setDialog] = useState<"refresh" | "reload" | null>(null), [conflict, setConflict] = useState(false);
  const parsed = useMemo(() => positionMapPlanSchema.safeParse({ positions: Object.fromEntries(Object.entries(draft).map(([id, row]) => [id, {
    required: row.required.trim() === "" ? NaN : Number(row.required), staffed: row.staffed.trim() === "" ? NaN : Number(row.staffed),
  }])) }), [draft]);
  const baseline = useMemo(() => toDraft(record.plan), [record.plan]);
  const changed = rows.filter(row => draft[row.id].required !== baseline[row.id].required || draft[row.id].staffed !== baseline[row.id].staffed).length;
  const dirty = changed > 0, canSave = parsed.success && (dirty || record.revision === 0);
  const plan = parsed.success ? parsed.data : record.plan;
  const summary = useMemo(() => positionMapSummary(plan), [plan]);
  const diagrams = useMemo(() => buildPositionMapPages(plan, record.year), [plan, record.year]);
  const filtered = rows.filter(row => (scope === "all" || (scope === "uptd" ? positionMapIsUptd(row.unit) : !positionMapIsUptd(row.unit)))
    && (!unit || row.unit === unit) && (kind === "all" || row.kind === kind)
    && `${row.name} ${row.unit}`.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID")));
  const pages = Math.max(1, Math.ceil(filtered.length / 20)), current = Math.min(page, pages), start = (current - 1) * 20;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function updateFilter(action: () => void) { action(); setPage(1); }
  function setValue(id: string, field: "required" | "staffed", value: string) {
    setDraft(previous => ({ ...previous, [id]: { ...previous[id], [field]: value } }));
  }
  async function save() {
    if (!parsed.success) return toast.error("Isi kebutuhan dan bezetting dengan bilangan bulat 0–999.");
    setBusy("save");
    try {
      const response = await fetch(`/api/position-map/${record.year}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: parsed.data, revision: record.revision }) });
      const data = await response.json();
      if (!response.ok) { if (response.status === 409) setConflict(true); throw new Error(data.message ?? "Peta jabatan gagal disimpan."); }
      setRecord(data.record); setDraft(toDraft(data.record.plan)); setConflict(false); toast.success(data.message);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Peta jabatan gagal disimpan."); }
    finally { setBusy(""); }
  }
  async function refresh(mode: "refresh" | "reload") {
    setDialog(null); setBusy(mode);
    try {
      const response = await fetch(`/api/position-map/${record.year}`, { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Data terbaru gagal dimuat.");
      if (mode === "refresh" && data.record.revision !== record.revision) { setConflict(true); throw new Error("Simpanan telah berubah. Muat simpanan terbaru terlebih dahulu."); }
      setStaff(data.staff); setToday(data.today);
      if (mode === "reload") { setRecord(data.record); setDraft(toDraft(data.record.plan)); setConflict(false); toast.success("Simpanan terbaru berhasil dimuat."); }
      else { setDraft(previous => Object.fromEntries(Object.entries(previous).map(([id, value]) => [id, { ...value, staffed: String(data.staff.counts[id] ?? 0) }]))); toast.success("Bezetting diperbarui dari pegawai aktif. Simpan perubahan untuk menerapkannya."); }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Data terbaru gagal dimuat."); }
    finally { setBusy(""); }
  }
  return <div className="min-w-0 space-y-5">
    <section className="rounded-xl border bg-white p-5 dark:bg-zinc-950" aria-label="Pengaturan peta jabatan">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <form action="/dashboard/peta-jabatan" className="flex flex-wrap items-end gap-2"><div><label htmlFor="peta-tahun" className="mb-1.5 block text-sm font-medium">Tahun peta jabatan</label><Input key={record.year} id="peta-tahun" name="tahun" type="number" min={2000} max={2099} defaultValue={record.year} required disabled={dirty || !!busy} className="h-10 w-28" /></div><Button type="submit" variant="outline" size="lg" disabled={dirty || !!busy}>Buka tahun</Button></form>
        <div className="flex flex-wrap gap-2"><Button variant="outline" size="lg" disabled={!!busy} onClick={() => setDialog("refresh")}><RefreshCw className="size-4" />Perbarui bezetting</Button><Button size="lg" className="bg-emerald-700 text-white hover:bg-emerald-800" disabled={!canSave || !!busy} onClick={save}>{busy === "save" ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Simpan peta</Button><a download href={`/api/position-map/${record.year}/docx`} aria-disabled={dirty || !!busy || !parsed.success} onClick={event => { if (dirty || busy || !parsed.success) { event.preventDefault(); toast.error("Simpan perubahan sebelum mengunduh DOCX."); } }} className={`inline-flex h-9 items-center gap-2 rounded-lg bg-blue-700 px-3 text-sm font-medium text-white hover:bg-blue-800 ${dirty || busy || !parsed.success ? "cursor-not-allowed opacity-50" : ""}`}><Download className="size-4" />Unduh DOCX</a></div>
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-500">{record.revision ? `Simpanan tahun ${record.year} · versi ${record.revision}.` : `Belum ada simpanan tahun ${record.year}. Nilai awal tersedia untuk ditinjau dan disimpan.`} Kebutuhan dan bezetting dapat diedit tanpa mengubah data induk pegawai.</p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">Bezetting dari data aktif per {today}: {staff.mapped} dari {staff.active} pegawai terpetakan; {staff.unmapped} belum cocok dengan jabatan dan unit. Kebutuhan awal mengikuti lampiran bezetting serta peta jabatan DKPP 2026. Kekurangan ditampilkan dengan tanda minus.</p>
      <details className="mt-2 text-xs leading-5 text-zinc-500"><summary className="cursor-pointer font-medium">Dasar dan cakupan peta</summary><p className="mt-1">Peta ini memuat 179 penempatan pada peta jabatan DKPP 2026 dan tambahan JF Penata Perizinan Ahli Pertama pada Bidang Produksi Peternakan dari lampiran bezetting. Dua jabatan Analis Kebijakan di Sekretariat tetap disertakan. Penyesuaian pada menu ini disimpan tersendiri untuk setiap tahun.</p></details>
      {dirty && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-amber-700" role="status"><span>{changed} jabatan diubah · belum disimpan</span><Button variant="ghost" size="sm" disabled={!!busy} onClick={() => setDraft(toDraft(record.plan))}><Undo2 className="size-3.5" />Batal perubahan</Button><span className="text-xs">Simpan sebelum mengunduh atau membuka tahun lain.</span></div>}
      {!parsed.success && <p className="mt-2 text-sm text-red-600" role="alert">Lengkapi semua kebutuhan dan bezetting dengan bilangan bulat 0–999.</p>}
      {conflict && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-amber-700" role="alert">Simpanan telah diubah pengguna lain.<Button variant="outline" size="sm" disabled={!!busy} onClick={() => setDialog("reload")}>Muat simpanan terbaru</Button></div>}
    </section>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[
      ["Kebutuhan", summary.required], ["Bezetting", summary.staffed], ["Selisih B − K", summary.balance], ["Kekurangan per jabatan", summary.shortage], ["Kelebihan per jabatan", summary.surplus],
    ].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4 dark:bg-zinc-950"><p className="text-xs leading-5 text-zinc-500">{label}</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${Number(value) < 0 ? "text-red-600" : Number(value) > 0 && String(label).includes("Kelebihan") ? "text-emerald-700" : ""}`}>{parsed.success ? value : "—"}</p></div>)}</div>
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white dark:bg-zinc-950">
      <div className="flex flex-wrap gap-2 border-b p-3" aria-label="Tampilan peta jabatan"><Button variant={tab === "data" ? "default" : "ghost"} onClick={() => setTab("data")}><List className="size-4" />Data jabatan</Button><Button variant={tab === "preview" ? "default" : "ghost"} disabled={!parsed.success} onClick={() => setTab("preview")}><Eye className="size-4" />Pratinjau bagan</Button></div>
      {tab === "data" ? <>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-zinc-400" /><Input aria-label="Cari jabatan atau unit peta" value={search} onChange={event => updateFilter(() => setSearch(event.target.value))} placeholder="Cari jabatan atau unit…" className="h-10 pl-9" /></div><select aria-label="Lingkup peta jabatan" value={scope} onChange={event => updateFilter(() => { setScope(event.target.value); setUnit(""); })} className={selectClass}><option value="all">Dinas dan UPTD</option><option value="dinas">Bagan dinas</option><option value="uptd">Rincian UPTD</option></select><select aria-label="Jenis jabatan peta" value={kind} onChange={event => updateFilter(() => setKind(event.target.value))} className={selectClass}><option value="all">Semua jenis jabatan</option>{["Fungsional", "Pelaksana", "Struktural"].map(value => <option key={value}>{value}</option>)}</select><select aria-label="Unit kerja peta" value={unit} onChange={event => updateFilter(() => setUnit(event.target.value))} className={selectClass}><option value="">Semua unit kerja</option>{unitOptions.filter(value => scope === "all" || (scope === "uptd" ? positionMapIsUptd(value) : !positionMapIsUptd(value))).map(value => <option key={value}>{value}</option>)}</select></div>
        <TableHorizontalScroll label="peta jabatan"><TableHeader><TableRow><TableHead className="w-14">No.</TableHead><TableHead>Jabatan dan unit kerja</TableHead><TableHead>Jenis</TableHead><TableHead>Kebutuhan (K)</TableHead><TableHead>Bezetting (B)</TableHead><TableHead>Selisih B − K</TableHead></TableRow></TableHeader><TableBody>{filtered.slice(start, start + 20).map(row => {
          const value = draft[row.id], validK = value.required.trim() !== "" && Number.isInteger(Number(value.required)) && Number(value.required) >= 0 && Number(value.required) <= 999;
          const validB = value.staffed.trim() !== "" && Number.isInteger(Number(value.staffed)) && Number(value.staffed) >= 0 && Number(value.staffed) <= 999;
          const delta = validK && validB ? Number(value.staffed) - Number(value.required) : null;
          const modified = value.required !== baseline[row.id].required || value.staffed !== baseline[row.id].staffed;
          return <TableRow key={row.id} data-position-id={row.id} className={modified ? "[&>td]:bg-amber-50 dark:[&>td]:bg-amber-950/30" : undefined}><TableCell className="text-zinc-500">{row.index}</TableCell><TableCell className="min-w-72 whitespace-normal"><p className="font-medium">{row.name}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{row.unit}</p></TableCell><TableCell><span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${colors[row.kind] ?? "bg-zinc-100"}`}>{row.kind}</span></TableCell><TableCell><Input aria-label={`Kebutuhan ${row.name} ${row.unit}`} data-field="required" type="number" min={0} max={999} step={1} inputMode="numeric" value={value.required} disabled={!!busy} aria-invalid={!validK} onChange={event => setValue(row.id, "required", event.target.value)} className="h-9 w-24 text-center tabular-nums" /></TableCell><TableCell><Input aria-label={`Bezetting ${row.name} ${row.unit}`} data-field="staffed" type="number" min={0} max={999} step={1} inputMode="numeric" value={value.staffed} disabled={!!busy} aria-invalid={!validB} onChange={event => setValue(row.id, "staffed", event.target.value)} className="h-9 w-24 text-center tabular-nums" /></TableCell><TableCell className={`text-center font-semibold tabular-nums ${delta !== null && delta < 0 ? "text-red-600" : delta !== null && delta > 0 ? "text-emerald-700" : ""}`}>{delta ?? "—"}</TableCell></TableRow>;
        })}{!filtered.length && <TableRow><TableCell colSpan={6} className="h-24 text-center text-zinc-500">Tidak ada jabatan yang sesuai pencarian.</TableCell></TableRow>}</TableBody></TableHorizontalScroll>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm"><p className="text-zinc-500">{filtered.length ? start + 1 : 0}–{Math.min(start + 20, filtered.length)} dari {filtered.length} jabatan</p><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Halaman sebelumnya peta jabatan" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft className="size-4" /></Button><span>{current} / {pages}</span><Button variant="outline" size="icon" aria-label="Halaman berikutnya peta jabatan" disabled={current >= pages} onClick={() => setPage(current + 1)}><ChevronRight className="size-4" /></Button></div></div>
      </> : <div className="space-y-5 bg-zinc-100 p-3 md:p-5 dark:bg-zinc-900"><div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3 dark:bg-zinc-950"><p className="text-sm">{diagrams.length} halaman A3 landscape · bagan dinas dan 21 UPTD</p><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Perkecil bagan" disabled={zoom <= 50} onClick={() => setZoom(zoom - 25)}><ZoomOut className="size-4" /></Button><span className="w-12 text-center text-sm tabular-nums">{zoom}%</span><Button variant="outline" size="icon" aria-label="Perbesar bagan" disabled={zoom >= 250} onClick={() => setZoom(zoom + 25)}><ZoomIn className="size-4" /></Button><Button variant="ghost" size="sm" onClick={() => setZoom(100)}>Pas lebar</Button></div></div>{diagrams.map((diagram, i) => <div key={diagram.title} className="overflow-hidden rounded-lg border bg-white"><h3 className="border-b px-4 py-3 text-sm font-medium text-zinc-800">Halaman {i + 1} · {diagram.title}</h3><div className="max-h-[70vh] overflow-auto bg-zinc-200 p-2" tabIndex={0} aria-label={`Area pratinjau ${diagram.title}`}><div style={{ width: `${zoom}%` }}><PositionMapDiagram page={diagram} /></div></div></div>)}</div>}
    </section>
    {dirty && <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg dark:bg-zinc-950"><p className="text-sm text-amber-800">{changed} jabatan belum disimpan</p><div className="flex gap-2"><Button variant="outline" disabled={!!busy} onClick={() => setDraft(toDraft(record.plan))}>Batal perubahan</Button><Button className="bg-emerald-700 text-white hover:bg-emerald-800" disabled={!canSave || !!busy} onClick={save}>{busy === "save" ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Simpan perubahan</Button></div></div>}
    <Dialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}><DialogContent><DialogHeader><DialogTitle>{dialog === "reload" ? "Muat simpanan terbaru?" : "Perbarui bezetting dari pegawai aktif?"}</DialogTitle><DialogDescription>{dialog === "reload" ? "Perubahan yang belum disimpan akan diganti dengan simpanan terbaru untuk tahun ini." : "Bezetting seluruh jabatan akan dihitung ulang dari pegawai aktif yang cocok dengan jabatan dan unit. Angka kebutuhan tetap menggunakan isian Anda. Hasilnya dapat ditinjau sebelum disimpan."}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Batal</Button><Button onClick={() => { if (dialog) void refresh(dialog); }}>{dialog === "reload" ? "Muat terbaru" : "Perbarui bezetting"}</Button></DialogFooter></DialogContent></Dialog>
    {busy && busy !== "save" && <p className="flex items-center gap-2 text-sm text-zinc-500" role="status"><LoaderCircle className="size-4 animate-spin" />Memuat data terbaru…</p>}
  </div>;
}
