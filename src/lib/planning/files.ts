import "server-only";
import ExcelJS from "exceljs";
import { achievement, budgetFor, isExample, summarize, type Evidence, type Evaluation, type Money } from "./model";
import { PlanningError, requireAdmin, type PlanningContext } from "./store";
import { rupiah } from "./actions";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const columns = ["Tahun", "Kode subkegiatan", "Nama subkegiatan", "Pagu saat ini", "Pagu baru"];
const subactivities = (ctx: PlanningContext) => ctx.catalog.nodes.filter(node => node.type === "subkegiatan" && !isExample(node.source));

export async function budgetTemplate(ctx: PlanningContext) {
  requireAdmin(ctx);
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Pagu", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map((header, i) => ({ header, width: [12, 25, 80, 22, 22][i] }));
  sheet.getColumn(2).numFmt = "@";
  for (const index of [4, 5]) sheet.getColumn(index).numFmt = "#,##0";
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
  for (const node of subactivities(ctx)) {
    const budget = budgetFor(node, ctx.year, ctx.get<Money>("budget", node.id));
    sheet.addRow([ctx.year, node.code, node.title, budget.amount, null]);
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

// XLSX is a ZIP. Reject unexpectedly large expansions and encrypted/ZIP64
// workbooks before the parser expands them in a serverless process.
function checkZip(bytes: Buffer) {
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > bytes.length) throw new PlanningError("Berkas Excel tidak dapat dibuka.");
  const entries = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16), total = 0;
  if (entries > 500 || bytes.readUInt16LE(end + 4) !== 0) throw new PlanningError("Paket Excel tidak didukung.");
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50 || (bytes.readUInt16LE(offset + 8) & 1))
      throw new PlanningError("Paket Excel tidak valid.");
    total += bytes.readUInt32LE(offset + 24);
    if (total > 32 * 1024 * 1024) throw new PlanningError("Isi workbook terlalu besar.");
    offset += 46 + bytes.readUInt16LE(offset + 28) + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
  }
}

export async function budgetPreview(ctx: PlanningContext, bytes: Buffer) {
  requireAdmin(ctx);
  checkZip(bytes);
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer); }
  catch { throw new PlanningError("Berkas .xlsx tidak dapat dibaca."); }
  const sheet = workbook.getWorksheet("Pagu");
  if (!sheet || columns.some((column, i) => sheet.getRow(1).getCell(i + 1).text.trim() !== column))
    throw new PlanningError("Gunakan template dengan lembar Pagu dan judul kolom yang sesuai.");
  if (sheet.rowCount > 500) throw new PlanningError("Lembar Pagu melebihi 500 baris.");
  const errors: string[] = [], seen = new Map<string, number>();
  const rows: { nodeId: string; code: string; title: string; row: number; old: number | null; amount: number; expectedRevision: number }[] = [];
  const nodes = subactivities(ctx);
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r), value = row.getCell(5).value;
    const code = typeof row.getCell(2).value === "string" ? row.getCell(2).text.trim() : "";
    const candidates = nodes.filter(node => node.code === code);
    if (code && seen.has(code)) errors.push(`Baris ${r} dan ${seen.get(code)} — kode berulang.`);
    if (code) seen.set(code, r);
    if (value === null || value === "" || (typeof value === "string" && !value.trim())) continue;
    if (String(row.getCell(1).value) !== String(ctx.year)) { errors.push(`Baris ${r} — tahun berbeda dari tahun kerja.`); continue; }
    if (candidates.length !== 1) { errors.push(`Baris ${r} — kode subkegiatan tidak ditemukan atau ambigu.`); continue; }
    const parsed = rupiah.safeParse(typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value);
    if (!parsed.success) { errors.push(`Baris ${r} — pagu harus berupa Rupiah bulat nonnegatif. Salin hasil formula sebagai nilai.`); continue; }
    const node = candidates[0];
    const old = ctx.get<Money>("budget", node.id);
    rows.push({ nodeId: node.id, code, title: node.title, row: r, amount: parsed.data, old: budgetFor(node, ctx.year, old).amount, expectedRevision: old?.revision ?? 0 });
  }
  return { version: ctx.version, rows, errors };
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const safe = typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]|^[＝＋＠－]/u.test(raw) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function planningCsv(ctx: PlanningContext, kind: "anggaran" | "capaian", department: string | null) {
  const rows: unknown[][] = [];
  const inScope = (owner: ReturnType<PlanningContext["assigned"]>) =>
    ctx.canAccess(owner) && (!department || owner.department === department);
  const depName = (id: string | null) => ctx.catalog.departments.find(dep => dep.id === id)?.name ?? "";
  const sourceLabel = (source: { doc?: string; table?: string; printedPage?: number } | undefined) =>
    [ctx.catalog.documents.find(doc => doc.id === source?.doc)?.kind, source?.table && `Tabel ${source.table}`, source?.printedPage && `hlm. ${source.printedPage}`].filter(Boolean).join(" · ");
  if (kind === "anggaran") {
    rows.push(["Kode", "Subkegiatan", "Tahun", "TW", "Pagu", "Sumber pagu", "Realisasi kumulatif", "Serapan (%)", "Sisa", "Bidang", "Penanggung jawab", "Bukti aktif", "Catatan"]);
    for (const node of subactivities(ctx)) {
      const owner = ctx.assigned(node);
      if (!inScope(owner)) continue;
      const budget = budgetFor(node, ctx.year, ctx.get<Money>("budget", node.id));
      const financial = ctx.get<Money>("financial", node.id, ctx.quarter)?.data;
      const totals = summarize([{ budget: budget.amount, real: financial?.amount ?? null }]);
      const evidenceCount = ctx.evidence.filter((row: { data: Evidence }) => row.data.nodeId === node.id && !row.data.archived && ctx.evidenceVisible(row.data)).length;
      rows.push(["'" + node.code, node.title, ctx.year, ctx.quarter, budget.amount, budget.source, totals.real, totals.absorption, totals.remaining, depName(owner.department), owner.ownerName, evidenceCount,
        [budget.note, financial?.note].filter(Boolean).join(" · ")]);
    }
  } else {
    rows.push(["ID simpul", "Kode", "Simpul", "ID indikator", "Indikator", "Satuan", "Arah", "Tahun", "TW", "Target", "Realisasi", "Capaian (%)", "Status", "Kendala", "Tindak lanjut", "Tenggat", "Catatan pemeriksa", "Bidang", "Penanggung jawab", "Sumber"]);
    for (const { node, indicator } of ctx.indicators.values()) {
      const owner = ctx.assigned(node, indicator.id);
      if (!inScope(owner) || isExample(node.source) || isExample(indicator.source)) continue;
      const target = ctx.get<{ value: number | null; source: string }>("target", indicator.id);
      const value = target ? target.data.value : indicator.targets?.[ctx.year] ?? null;
      const e = ctx.get<Evaluation>("evaluation", indicator.id, ctx.quarter)?.data;
      rows.push([node.id, "'" + node.code, node.title, indicator.id, indicator.name, indicator.unit, indicator.direction, ctx.year, ctx.quarter,
        value, e?.real, achievement(value, e?.real ?? null, indicator.direction), e?.status, e?.issue, e?.followup, e?.deadline, e?.reviewNote, depName(owner.department), owner.ownerName,
        [target?.data.source ?? sourceLabel(indicator.source), indicator.review].filter(Boolean).join(" · ")]);
    }
  }
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
