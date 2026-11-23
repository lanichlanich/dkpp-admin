"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, BookOpen, Building2, CalendarDays, ChartNoAxesCombined, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, ClipboardList, Coins, Download, FilePenLine, FilterX, Flag, FolderTree, Layers3, ListChecks, Lock, Paperclip, Percent, RefreshCw, Search, SearchX, Send, ShieldCheck, Target, Wallet, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { actionIcons, tones } from "./planning-style";
import { Button } from "@/components/ui/button";
import { achievement, LEVELS, summarize, YEARS, type Source } from "@/lib/planning/model";
import type { PlanningView } from "@/lib/planning/store";
import { buttonStyle, fieldStyle, money, number, PlanningDialog, type DialogState, type ViewEvidence, type ViewIndicator, type ViewNode } from "./planning-dialog";

const endpoint = "/api/pagu-target-realisasi";
const statuses = { draft: "Draf", submitted: "Diajukan", returned: "Dikembalikan", checked: "Selesai diperiksa" };
const levelIcons = { subkegiatan: ListChecks, kegiatan: ClipboardList, program: Layers3, sasaran: Target, tujuan: Flag, iku: ChartNoAxesCombined };
const statusStyles = {
  draft: ["neutral", FilePenLine], submitted: ["sky", Send], returned: ["amber", CircleAlert], checked: ["emerald", CircleCheck],
} as const;
const quarterNames = ["I", "II", "III", "IV"];
const labels = { subkegiatan: "Subkegiatan", kegiatan: "Kegiatan", program: "Program", sasaran: "Sasaran", tujuan: "Tujuan", iku: "IKU" };
const levels = ["subkegiatan", "kegiatan", "program", "sasaran", "tujuan", "iku"] as const;
const PAGE_SIZE = 15;
const linkStyle = "inline-flex min-h-11 items-center gap-2 rounded-lg border bg-background px-3 py-2 font-medium text-foreground hover:bg-muted focus-visible:outline-2";
const terms = (value: string) => value.toLocaleLowerCase("id").trim();

function sourceText(view: PlanningView, source?: Source) {
  const doc = view.documents.find(item => item.id === source?.doc);
  return [doc?.kind, source?.table && `Tabel ${source.table}`, source?.printedPage && `hlm. ${source.printedPage}`].filter(Boolean).join(" · ");
}

function Metric({ label, value, caption, icon: Icon, tone }: { label: string; value: string; caption?: string; icon: LucideIcon; tone: keyof typeof tones }) {
  return <Card className={`min-w-0 gap-0 rounded-xl p-3 sm:p-4 ${tones[tone]}`}>
    <p className="flex items-start gap-2 text-sm font-semibold"><Icon aria-hidden className="mt-0.5 size-4 shrink-0"/>{label}</p>
    <p className="mt-2 break-words text-lg font-bold tabular-nums sm:text-xl xl:text-2xl">{value}</p>
    {caption && <p className="mt-1 text-xs leading-relaxed">{caption}</p>}
  </Card>;
}

export function PlanningWorkspace({ initial }: { initial: PlanningView }) {
  const [view, setView] = useState(initial);
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState<typeof LEVELS[number]>("subkegiatan");
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean }>();
  const { year, quarter, isAdmin: admin, period } = view;
  const q = quarterNames[quarter - 1];
  const apiUrl = `${endpoint}?year=${year}&quarter=${quarter}`;
  const depName = (id: string | null | undefined) => view.departments.find(dep => dep.id === id)?.name ?? "Belum ditetapkan";
  const snapshot = new Date(view.snapshot.exportedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "short" });
  const selected = useMemo(() => {
    const nodes = new Map(view.nodes.map(node => [node.id, node]));
    const chains = new Map(view.nodes.map(node => {
      const chain = [node];
      for (let parent = node.parent && nodes.get(node.parent); parent; parent = parent.parent && nodes.get(parent.parent)) chain.push(parent);
      return [node.id, chain] as const;
    }));
    const search = terms(query);
    const hasIndicator = (node: ViewNode, iku = false) => node.indicators.some(i =>
      (!iku || i.iku) && (!department || i.owner.department === department) && (!search || terms(i.name).includes(search)));
    const matchesNode = (node: ViewNode) => !search || chains.get(node.id)!.some(item =>
      terms(item.code + " " + item.title).includes(search) || hasIndicator(item));
    const leaves = view.nodes.filter(node => node.type === "subkegiatan" && node.budget &&
      (!department || node.owner?.department === department) && matchesNode(node));
    const forRow = (node: ViewNode) => leaves.filter(leaf => chains.get(leaf.id)!.some(ancestor => ancestor.id === node.id));
    const showIndicator = (i: ViewIndicator) => (!department || i.owner.department === department);
    const included = new Set(leaves.flatMap(node => chains.get(node.id)!.map(ancestor => ancestor.id)));
    for (const node of view.nodes) {
      if (!matchesNode(node) || (!node.indicators.some(showIndicator) && (department || !node.visible || node.type === "subkegiatan"))) continue;
      for (const ancestor of chains.get(node.id)!) included.add(ancestor.id);
    }
    const include = (node: ViewNode) => included.has(node.id);
    const items = view.nodes.filter(node => level === "iku"
      ? node.indicators.some(i => i.iku && showIndicator(i) && (matchesNode(node) || terms(i.name).includes(search)))
      : node.type === level && include(node));
    const children = (node: ViewNode) => view.nodes.filter(item => item.parent === node.id && include(item));
    return { leaves, items, forRow, children, showIndicator };
  }, [view.nodes, department, query, level]);
  const total = summarize(selected.leaves.map(node => ({ budget: node.budget?.amount ?? null, real: node.financial?.data.amount ?? null })));
  const pages = Math.max(1, Math.ceil(selected.items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);

  async function load(nextYear = year, nextQuarter = quarter, message?: string) {
    setLoading(true);
    if (!message) setFeedback(undefined);
    try {
      const response = await fetch(`${endpoint}?year=${nextYear}&quarter=${nextQuarter}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Gagal memuat data.");
      setView(result);
      if (nextYear !== year || nextQuarter !== quarter) { setPage(1); setOpened(new Set()); }
      if (message) setFeedback({ message });
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : "Gagal memuat data.", error: true }); }
    finally { setLoading(false); }
  }
  function toggle(id: string) {
    setOpened(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function action(title: string, state: DialogState, primary = false) {
    const Icon = actionIcons[state.action];
    return <Button type="button" className={buttonStyle} disabled={loading} variant={primary ? "default" : "outline"} onClick={() => setDialog(state)}><Icon aria-hidden/>{title}</Button>;
  }
  function proof(node: ViewNode, indicator?: ViewIndicator) {
    const records = view.evidence.filter(item => item.data.nodeId === node.id && (item.data.indicatorId ?? null) === (indicator?.id ?? null));
    const write = !period.closed && (indicator !== undefined || node.visible);
    const eligible = indicator || ["kegiatan", "subkegiatan"].includes(node.type);
    if (quarter !== 4 || (!records.length && !(write && eligible))) return null;
    return <details className="min-w-0 rounded-lg border bg-card px-3">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium text-emerald-900 dark:text-emerald-200"><Paperclip className="size-4" aria-hidden="true" />Bukti final ({records.filter(r => !r.data.archived).length})</summary>
      <div className="space-y-2 pb-3">
        {records.map(record => evidenceCard(record, node, indicator))}
        {write && eligible && action("Unggah bukti", { action: "upload", node, indicator })}
      </div>
    </details>;
  }
  function evidenceCard(record: ViewEvidence, node: ViewNode, indicator?: ViewIndicator) {
    const data = record.data;
    const manage = !period.closed && record.manageable;
    return <div key={record.subject} className="space-y-1 rounded-lg border p-3">
      <p className="break-words font-medium">{data.title}</p>
      {!record.available && <p className="text-amber-900">Berkas belum dipindahkan</p>}
      {data.migrationFile?.verifyAssociation && <p className="text-amber-900">Kesesuaian bukti dengan kode subkegiatan perlu diperiksa Admin.</p>}
      {data.archived && <p className="text-muted-foreground">Diarsipkan</p>}
      <div className="flex flex-wrap gap-2">
        {record.available && <a className={linkStyle} href={apiUrl + "&evidence=" + encodeURIComponent(record.subject)}><Download className="size-4" aria-hidden/>Unduh bukti</a>}
        {admin && !period.closed && !record.available && !data.archived && data.migrationFile &&
          action("Pindahkan bukti SIPENA", { action: "upload", evidence: record, node, indicator })}
        {manage && action(data.archived ? "Pulihkan" : "Arsipkan", { action: "archive", evidence: record })}
      </div>
    </div>;
  }
  function indicatorCard(node: ViewNode, indicator: ViewIndicator) {
    const evaluation = indicator.evaluation?.data;
    const status = evaluation?.status;
    const [tone, StatusIcon] = status ? statusStyles[status] : ["neutral", CircleAlert] as const;
    const canEdit = !period.closed;
    const source = indicator.target?.data.source || sourceText(view, indicator.source);
    const metadata = indicator.method;
    return <article key={indicator.id} className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 font-semibold text-foreground">{indicator.name}</h3>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}><StatusIcon className="size-3.5" aria-hidden/>{status ? statuses[status] : "Belum diisi"}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 [&>p]:rounded-lg [&>p]:p-2.5">
        <p className={tones.indigo}><Target className="mr-1 inline size-4" aria-hidden/>Target tahunan <strong className="block">{number(indicator.effectiveTarget)} {indicator.unit}</strong></p>
        <p className={tones.emerald}><ChartNoAxesCombined className="mr-1 inline size-4" aria-hidden/>Realisasi TW {q} <strong className="block">{number(evaluation?.real)} {indicator.unit}</strong></p>
        <p className={tones.sky}><Percent className="mr-1 inline size-4" aria-hidden/>Capaian <strong className="block">{evaluation?.real == null || achievement(indicator.effectiveTarget, evaluation.real, indicator.direction) === null
          ? "—" : number(achievement(indicator.effectiveTarget, evaluation.real, indicator.direction)) + "%"}</strong></p>
      </div>
      <p className="text-muted-foreground">{depName(indicator.owner.department)} · {indicator.owner.ownerName ?? "Penanggung jawab belum ditetapkan"}</p>
      {source && <p className="text-muted-foreground">Sumber · {source}</p>}
      {indicator.review && <p className="text-amber-900">Perlu verifikasi · {indicator.review}</p>}
      {evaluation?.issue && <p>Kendala · {evaluation.issue}</p>}
      {evaluation?.followup && <p>Tindak lanjut · {evaluation.followup}</p>}
      {evaluation?.deadline && <p>Tenggat · {evaluation.deadline}</p>}
      {evaluation?.reviewNote && <p>Catatan pemeriksa · {evaluation.reviewNote}</p>}
      {metadata && <details className="rounded-lg border px-3"><summary className="flex min-h-11 cursor-pointer items-center font-medium">Metode indikator · Tabel {metadata.table}</summary>
        <dl className="space-y-2 pb-3">{Object.entries(metadata.fields).map(([key, value]) => <div key={key}><dt className="font-medium">{key}</dt><dd className="whitespace-pre-line break-words text-muted-foreground">{value}</dd></div>)}</dl>
      </details>}
      <div className="flex flex-wrap gap-2">
        {admin && action("Edit target", { action: "target", node, indicator })}
        {admin && action("Atur penugasan", { action: "assignment", node, indicator })}
        {canEdit && (period.reopened || (status !== "checked" && status !== "submitted")) && action("Isi capaian", { action: "evaluation", node, indicator }, true)}
        {canEdit && admin && status === "submitted" && action("Periksa capaian", { action: "review", node, indicator }, true)}
      </div>
      {proof(node, indicator)}
    </article>;
  }
  function row(node: ViewNode, iku = false) {
    const key = iku ? node.id + "|iku" : node.id;
    const open = opened.has(key);
    const totals = summarize(selected.forRow(node).map(item => ({ budget: item.budget?.amount ?? null, real: item.financial?.data.amount ?? null })));
    const children = iku ? [] : selected.children(node);
    const writable = node.visible;
    return <article key={key} className="min-w-0 rounded-xl border bg-card">
      <button type="button" onClick={() => toggle(key)} aria-expanded={open}
        className="grid min-h-14 w-full cursor-pointer grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 rounded-xl p-3 text-left hover:bg-muted/65 focus-visible:outline-2 focus-visible:outline-ring sm:p-4 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_1.25rem] lg:items-center">
        <span className="col-span-3 min-w-0 lg:col-span-1"><span className="block break-words font-semibold text-foreground">{node.title}</span><span className="block text-muted-foreground">{node.code}</span></span>
        <span className="min-w-0 break-words text-sm font-medium tabular-nums text-indigo-800 dark:text-indigo-300"><span className="block text-xs text-muted-foreground lg:sr-only">Pagu </span>{money(totals.budget)}</span>
        <span className="min-w-0 break-words text-sm font-medium tabular-nums text-emerald-800 dark:text-emerald-300"><span className="block text-xs text-muted-foreground lg:sr-only">Realisasi </span>{money(totals.real)}</span>
        <ChevronDown className={`size-5 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && <div className="space-y-4 border-t bg-muted/45 p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {node.owner && <p>{depName(node.owner.department)} · {node.owner.ownerName ?? "Penanggung jawab belum ditetapkan"}</p>}
          <p>Serapan · {totals.absorption === null ? "—" : number(totals.absorption) + "%"} &nbsp; Sisa · {money(totals.remaining)}</p>
        </div>
        {node.budget && <p>Sumber pagu · {node.budget.source}{node.budget.note && ` · ${node.budget.note}`}</p>}
        {node.financial?.data.note && <p>Catatan realisasi · {node.financial.data.note}</p>}
        <div className="flex flex-wrap gap-2">
          {admin && node.type === "subkegiatan" && action("Atur pagu", { action: "budget", node })}
          {admin && writable && !iku && action("Atur penugasan", { action: "assignment", node })}
          {!period.closed && writable && node.type === "subkegiatan" && action("Isi realisasi anggaran", { action: "financial", node }, true)}
        </div>
        {proof(node)}
        {node.indicators.filter(i => selected.showIndicator(i) && (!iku || i.iku)).map(i => indicatorCard(node, i))}
        {children.length > 0 && <div className="space-y-2 border-l-2 border-emerald-200 pl-2 sm:pl-4">
          <p className="font-medium text-foreground">Rincian di bawahnya</p>{children.map(child => row(child))}
        </div>}
      </div>}
    </article>;
  }

  return <div className="mx-auto max-w-7xl space-y-5 text-base" aria-busy={loading}>
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-100 via-teal-50 to-card p-4 dark:border-emerald-900 dark:from-emerald-950 dark:via-teal-950/50 sm:p-5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300"><ClipboardList className="size-5" aria-hidden="true" />Perencanaan</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Pagu, Target &amp; Realisasi</h1>
        <p className="mt-2 text-muted-foreground">Rujukan SIPENA {snapshot} WIB · Revisi {view.snapshot.planningRevision}</p>
      </div>
      <label className="block w-full font-medium sm:w-36"><span className="flex items-center gap-2"><CalendarDays className="size-4" aria-hidden/>Tahun kerja</span>
        <select className={fieldStyle} value={year} disabled={loading} onChange={event => { setPage(1); void load(Number(event.target.value)); }}>
          {YEARS.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
    </header>
    <section className="rounded-xl border bg-card p-4 sm:p-5" aria-label="Periode pelaporan">
      <h2 className="mb-3 flex items-center gap-2 font-semibold"><CalendarDays className="size-5 text-sky-700 dark:text-sky-300" aria-hidden/> Periode dan berkas</h2>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-48 font-medium">Periode
            <select className={fieldStyle} disabled={loading} value={quarter} onChange={event => void load(year, Number(event.target.value))}>
              {quarterNames.map((item, index) => <option key={item} value={index + 1}>Triwulan {item}{index === 3 ? " (final)" : ""}</option>)}
            </select>
          </label>
          <span className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 ${period.closed ? "bg-amber-100 text-amber-950" : "bg-emerald-50 text-emerald-950"}`}>
            {period.closed ? <Lock className="size-4" /> : <ShieldCheck className="size-4" />}
            {period.closed ? "Periode ditutup" : period.reopened ? "Periode dibuka kembali" : "Periode terbuka"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {admin && action("Impor pagu Excel", { action: "import" }, true)}
          <a className={linkStyle} href={apiUrl + "&file=anggaran&department=" + encodeURIComponent(department)}><Download className="size-4" />CSV anggaran</a>
          <a className={linkStyle} href={apiUrl + "&file=capaian&department=" + encodeURIComponent(department)}><Download className="size-4" />CSV capaian</a>
          <Button variant="outline" type="button" className={buttonStyle} disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? "animate-spin" : ""} />Muat ulang</Button>
        </div>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><ArrowDownToLine className="size-4 shrink-0" aria-hidden/> CSV mengikuti tahun, triwulan, bidang, dan hak akses; tidak mengikuti pencarian atau tingkat rekap.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="mr-2 text-muted-foreground">{admin ? "Admin" : "Penugasan akun"}{period.reason && ` · ${period.reason}`}</p>
        {admin && action("Atur periode", { action: "period" })}
      </div>
    </section>
    {feedback && <p role={feedback.error ? "alert" : "status"} className={`rounded-lg p-3 ${feedback.error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-950"}`}>{feedback.message}</p>}
    <section className="space-y-2" aria-labelledby="planning-summary">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3"><h2 id="planning-summary" className="font-semibold">Ringkasan anggaran · TW {q}</h2><p className="text-xs text-muted-foreground">{department || query.trim() ? "Mengikuti pencarian dan bidang aktif" : "Seluruh subkegiatan dalam cakupan akses"}</p></div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
      <Metric icon={Wallet} tone="indigo" label="Pagu tahunan terdata" value={money(total.budget)} caption={`${total.budgetCount} dari ${total.count} subkegiatan berpagu`} />
      <Metric icon={ChartNoAxesCombined} tone="emerald" label={`Realisasi sampai TW ${q}`} value={money(total.real)} caption={`${total.realCount} dari ${total.count} subkegiatan telah diisi`} />
      <Metric icon={Percent} tone="sky" label="Serapan anggaran" value={total.absorption === null ? "—" : `${number(total.absorption)}%`} caption={`${total.pairCount} subkegiatan dengan kedua angka`} />
      <Metric icon={Coins} tone="amber" label="Sisa anggaran" value={money(total.remaining)} caption={total.count > 0 && total.pairCount < total.count ? "Menunggu pagu dan realisasi lengkap" : undefined} />
      </div>
    </section>
    <section className="rounded-xl border bg-card p-4 sm:p-5" aria-label="Penyaring perencanaan">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><FolderTree className="size-5 text-indigo-700 dark:text-indigo-300" aria-hidden/> Telusuri data</h2>{(query || department) && <Button variant="outline" onClick={() => { setQuery(""); setDepartment(""); setPage(1); }}><FilterX aria-hidden/> Reset filter</Button>}</div>
      <div className="flex flex-wrap gap-2" aria-label="Tingkat rekap">
        {levels.map(item => { const Icon = levelIcons[item]; return <Button key={item} type="button" className={buttonStyle} aria-pressed={level === item}
          variant={level === item ? "default" : "outline"} onClick={() => { setLevel(item); setPage(1); }}>
          <Icon aria-hidden/>{labels[item]}
        </Button>; })}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="relative block space-y-1"><span className="font-medium">Pencarian</span>
          <Search aria-hidden="true" className="absolute bottom-3 left-3 size-5 text-zinc-500" />
          <input type="search" className={fieldStyle + " pl-10"} placeholder="Kode, kegiatan, atau indikator" value={query}
            onChange={event => { setQuery(event.target.value); setPage(1); }} />
        </label>
        <label className="block space-y-1 font-medium"><span className="flex items-center gap-2"><Building2 className="size-4" aria-hidden/>Bidang</span>
          <select className={fieldStyle} value={department} onChange={event => { setDepartment(event.target.value); setPage(1); }}>
            <option value="">Semua bidang</option>
            {view.departments.map(dep => <option key={dep.id} value={dep.id}>{dep.name}</option>)}
          </select>
        </label>
      </div>
    </section>
    <section className="space-y-2" aria-label="Daftar perencanaan">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3"><h2 className="font-semibold">Daftar {labels[level]} <span className="text-sm text-muted-foreground">({selected.items.length})</span></h2><p className="text-xs text-muted-foreground">Pilih baris untuk membuka rincian dan tindakan.</p></div>
      <div className="hidden grid-cols-[minmax(0,1fr)_10rem_10rem_1.25rem] gap-3 px-4 font-medium text-muted-foreground lg:grid">
        <span>{labels[level]}</span><span>Pagu tahunan</span><span>Realisasi TW {q}</span>
      </div>
      {selected.items.length === 0 && <p className="flex items-start gap-2 rounded-xl border bg-card p-5"><SearchX className="size-5 shrink-0 text-muted-foreground" aria-hidden/>
        {view.nodes.length === 0 ? `Belum ada penugasan untuk akun Anda pada tahun ${year}.` : "Tidak ada baris yang sesuai pencarian dan bidang."}
      </p>}
      {selected.items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(node => row(node, level === "iku"))}
      {selected.items.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 p-2">
        <p>{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, selected.items.length)} dari {selected.items.length} baris</p>
        <div className="flex gap-2">
          <Button variant="outline" className={buttonStyle} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden/>Sebelumnya</Button>
          <Button variant="outline" className={buttonStyle} disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Berikutnya<ChevronRight aria-hidden/></Button>
        </div>
      </div>}
    </section>
    <details className="rounded-xl border bg-card px-4">
      <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-medium"><BookOpen className="size-4" aria-hidden/>Rujukan dokumen</summary>
      <ul className="space-y-2 pb-4">{view.documents.map(doc => <li key={doc.id}><strong>{doc.kind} · {doc.period}</strong><p className="break-words">{doc.name}</p><p className="text-muted-foreground">{doc.note}</p></li>)}</ul>
    </details>
    {dialog && <PlanningDialog state={dialog} view={view} url={apiUrl} close={() => setDialog(undefined)}
      saved={async message => { setDialog(undefined); await load(year, quarter, message); }} />}
  </div>;
}
