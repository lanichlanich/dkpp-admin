import "server-only";
import PDFDocument from "pdfkit";
import template from "@/data/anjab-abk-pdf-template.json";
import { calculateAnjab, type AnjabPlan, type SourceCatalog, type SourceFamily, type SourceLevel } from "@/lib/anjab-abk-calculation";
import type { AnjabPdfSelection } from "@/lib/anjab-abk-pdf-options";

type CellValue = string | number | null;
type Cell = [number, number, CellValue, number];
type Sheet = { id: string; name: string; widths: number[]; heights: number[]; merges: number[][]; cells: Cell[]; landscape: boolean };
type Style = { size: number; narrow: boolean; bold: boolean; italic: boolean; underline: boolean; color: string; align: string; vertical: string; indent: number; format: string; fill: string | null; border: (string | null)[] };
type Calculation = ReturnType<typeof calculateAnjab>;
const styles = template.styles as Style[];
const sourceSheets = template.sheets as unknown as Sheet[];
const number = (n: number, digits = 6) => n.toLocaleString("id-ID", { maximumFractionDigits: digits });
const key = (row: number, col: number) => `${row}:${col}`;

export function anjabPdfFilename(year: number, selection: AnjabPdfSelection) {
  const suffix = selection.kind === "all" ? "gabungan-semua-dokumen" : selection.kind === "recap" ? `rekap-${selection.sheet}` : selection.levelId ?? selection.familyId;
  return `Anjab-ABK-${year}-${suffix}.pdf`;
}

/** Replace every calculated/input value; never export stale Excel formula caches. */
export function anjabPdfSheets(plan: AnjabPlan, catalog: SourceCatalog, selection: AnjabPdfSelection): Sheet[] {
  const result = calculateAnjab(plan, catalog), sheets: Sheet[] = [];
  const add = (id: string, overrides: Record<string, CellValue>) => {
    const source = sourceSheets.find(sheet => sheet.id === id);
    if (!source) throw new Error("Format dokumen tidak ditemukan.");
    const sheet = structuredClone(source);
    const done = new Set<string>();
    sheet.cells = sheet.cells.map(([r, c, value, style]) => {
      const id = key(r, c); done.add(id);
      return [r, c, Object.hasOwn(overrides, id) ? overrides[id] : value, style];
    });
    for (const [id, value] of Object.entries(overrides)) if (!done.has(id)) {
      const [r, c] = id.split(":").map(Number);
      const style = sheet.cells.find(cell => cell[1] === c && cell[0] === r - 1)?.[3] ?? 0;
      sheet.cells.push([r, c, value, style]);
    }
    sheets.push(sheet);
  };
  if (selection.kind !== "detail") {
    for (const name of ["perhitungan", "usulan", "penempatan"]) {
      if (selection.kind === "recap" && selection.sheet !== "all" && selection.sheet !== name) continue;
      const overrides: Record<string, CellValue> = {};
      const set = (r: number, c: number, v: CellValue) => { overrides[key(r, c)] = v; };
      if (name === "perhitungan") {
        const v = plan.variables, a = result.agency;
        set(6, 3, v.agencyType); set(6, 4, v.districtCount); set(6, 5, v.serviceUnitCount);
        set(6, 6, `${v.agencyType} = ${{ A: "Besar", B: "Sedang", C: "Kecil", D: "Lainnya" }[v.agencyType]}`);
        [v.weights.agency, v.weights.districts, v.weights.serviceUnits, 1].forEach((x, i) => set(12, 3 + i, x));
        [a.typeScore, a.districtScore, a.unitScore, a.score].forEach((x, i) => set(13, 3 + i, x));
        catalog.families.filter(f => Object.hasOwn(v.shares, f.id)).forEach((f, i) => { set(12, 8 + i, v.shares[f.id]); set(13, 8 + i, a.allocations[f.id]); });
        set(13, 12, a.existing); set(13, 13, a.scoreShortage);
      } else {
        const cols = name === "usulan" ? ["proposedPns", "proposedPppk", "existingPns", "existingPppk", "shortage"] as const : null;
        for (const family of catalog.families) {
          for (const level of family.levels) {
            const r = level.recommendationRow, calculated = result.levels[level.id];
            if (cols) cols.forEach((field, i) => set(r, 4 + i, calculated[field]));
            else {
              catalog.units.forEach((u, i) => { const p = plan.levels[level.id].placements[u.id]; set(r, 4 + 2 * i, p.pns); set(r, 5 + 2 * i, p.pppk); });
              set(r, 16, calculated.placed);
            }
          }
          const r = Math.max(...family.levels.map(l => l.recommendationRow)) + 1;
          if (cols) cols.forEach((field, i) => set(r, 4 + i, result.families[family.id][field]));
          else {
            catalog.units.forEach((u, i) => { for (const [j, field] of ["pns", "pppk"].entries()) set(r, 4 + 2 * i + j, family.levels.reduce((n, l) => n + plan.levels[l.id].placements[u.id][field as "pns" | "pppk"], 0)); });
            set(r, 16, result.families[family.id].placed);
          }
        }
      }
      add(name, overrides);
    }
  }
  if (selection.kind !== "recap") for (const family of catalog.families) {
    if (selection.kind === "detail" && selection.familyId !== family.id) continue;
    for (const level of family.levels) {
      if (selection.kind === "detail" && selection.levelId && selection.levelId !== level.id) continue;
      add(level.id, detailOverrides(plan, family, level, result));
    }
  }
  if (!sheets.length) throw new Error("Jabatan atau jenjang dokumen tidak valid.");
  return sheets;
}

function detailOverrides(plan: AnjabPlan, family: SourceFamily, level: SourceLevel, result: Calculation) {
  const current = plan.levels[level.id], r = result.levels[level.id], overrides: Record<string, CellValue> = {};
  const set = (row: number, col: number, value: CellValue) => { overrides[key(row, col)] = value; };
  for (const task of level.tasks) { set(task.row, 4, current.tasks[task.id].volume); set(task.row, 5, current.tasks[task.id].credit); set(task.row, 6, r.points[task.id]); }
  const totalRow = Number(level.totalCell.slice(1)), divisorRow = Number(level.divisorCell.slice(1)), requirementRow = Number(level.requirementCell.slice(1));
  set(totalRow, 6, r.total); set(requirementRow, 1, `Kebutuhan ${family.name} ${level.grade} = ABK / ${number(current.divisor)}`);
  set(requirementRow, 5, r.total); set(requirementRow, 6, r.ratio); set(divisorRow, 5, current.divisor); set(divisorRow, 6, `${number(r.need!)} Orang`);
  // A manually cached extra rounded value exists below the Medvet Muda formula.
  const source = sourceSheets.find(s => s.id === level.id)!;
  for (const [row, col, value] of source.cells) if (row > divisorRow && col === 6 && typeof value === "number") set(row as number, 6, r.need);
  return overrides;
}

function formatted(value: CellValue, style: Style) {
  if (typeof value !== "number") return String(value ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (style.format.includes("%")) return `${number(value * 100, 4)}%`;
  const match = style.format.match(/0\.([0#]+)/);
  const minimumFractionDigits = match ? [...match[1]].filter(c => c === "0").length : 0;
  return value.toLocaleString("id-ID", { minimumFractionDigits, maximumFractionDigits: Math.max(minimumFractionDigits, 8) });
}
function face(style: Style) { return style.bold ? style.italic ? "Helvetica-BoldOblique" : "Helvetica-Bold" : style.italic ? "Helvetica-Oblique" : "Helvetica"; }

/** Excel-derived widths, heights, merges, fills, borders and typography; paginate whole rows/merges. */
function drawSheet(pdf: PDFKit.PDFDocument, sheet: Sheet, year: number, result: Calculation) {
  const width = sheet.landscape ? 841.89 : 595.28, height = sheet.landscape ? 595.28 : 841.89;
  pdf.addPage({ size: [width, height], margin: 0 });
  const side = 18, top = 42, bottom = 42;
  let scale = Math.min(1, (width - side * 2) / sheet.widths.reduce((a, b) => a + b, 0));
  const x = [side]; for (const w of sheet.widths) x.push(x.at(-1)! + w * scale);
  const heights = sheet.heights.map(h => h * scale), cells: { row: number; col: number; endRow: number; endCol: number; text: string; style: Style; horizontalScale: number }[] = [];
  for (const [row, col, value, index] of sheet.cells) {
    const merge = sheet.merges.find(([c1, r1, c2, r2]) => col >= c1 && col <= c2 && row >= r1 && row <= r2);
    if (merge && (merge[0] !== col || merge[1] !== row)) continue;
    const style = styles[index], text = formatted(value, style);
    let endCol = merge?.[2] ?? col, endRow = merge?.[3] ?? row;
    if (!merge && text && typeof value === "string" && !style.fill && !style.border.some(Boolean)) {
      while (endCol < sheet.widths.length && !sheet.cells.some(c => c[0] === row && c[1] === endCol + 1 && c[2] !== null && String(c[2]).trim())) endCol++;
    }
    // Excel permits note text to overflow across adjoining empty cells.
    if (sheet.id === "perhitungan" && row === 18 && col === 2) { endCol = 13; endRow = 18; }
    const boxWidth = x[endCol] - x[col - 1] - 4 * scale - style.indent * 6 * scale;
    pdf.font(face(style)).fontSize(style.size * scale);
    const horizontalScale = Math.min(style.narrow ? .8 : 1, row <= 12 && text && !text.includes(" ") ? boxWidth / pdf.widthOfString(text) : 1);
    const needed = text ? pdf.heightOfString(text, { width: boxWidth / horizontalScale, lineGap: 0 }) + 4 * scale : 0;
    const available = heights.slice(row - 1, endRow).reduce((a, b) => a + b, 0);
    if (needed > available) heights[endRow - 1] += needed - available;
    cells.push({ row, col, endRow, endCol, text, style, horizontalScale });
  }
  if (sheet.id === "penempatan" || sheet.id === "usulan") {
    const fit = Math.min(1, (height - top - bottom - 38) / heights.reduce((a, b) => a + b, 0));
    for (let i = 0; i < heights.length; i++) heights[i] *= fit;
    for (let i = 0; i < x.length; i++) x[i] = side + (x[i] - side) * fit;
    scale *= fit;
  }
  // Keep the result, fraction and rounded requirement together on one page.
  const groups: number[][] = [];
  for (let r = 1; r <= heights.length;) {
    let end = r;
    for (let at = r; at <= end; at++) for (const cell of cells) if (cell.row === at) end = Math.max(end, cell.endRow);
    if (sheet.widths.length === 6 && r === Number((sourceSheets.find(s => s.id === sheet.id)?.cells.find(c => c[1] === 1 && String(c[2]).startsWith("Kebutuhan")) ?? [0])[0]) - 2) end = heights.length;
    groups.push(Array.from({ length: end - r + 1 }, (_, i) => r + i)); r = end + 1;
  }
  let y = top, localPage = 0;
  function page() { if (localPage) pdf.addPage({ size: [width, height], margin: 0 }); localPage++; y = top;
    pdf.font("Helvetica").fontSize(8).fillColor("#555555").text(`Tahun ${year} | ${sheet.widths.length === 6 ? "Rincian ABK" : sheet.name}`, side, 20, { width: width - side * 2 }); }
  function draw(rows: number[]) {
    const rowY = new Map<number, number>(); let next = y;
    for (const r of rows) { rowY.set(r, next); next += heights[r - 1]; }
    for (const cell of cells) {
      if (!rowY.has(cell.row)) continue;
      const { style, col, endCol, row, endRow, text } = cell;
      const xx = x[col - 1], yy = rowY.get(row)!, w = x[endCol] - xx, h = heights.slice(row - 1, endRow).reduce((a, b) => a + b, 0);
      if (style.fill) pdf.rect(xx, yy, w, h).fill(`#${style.fill}`);
      const edges = [[xx, yy, xx + w, yy], [xx + w, yy, xx + w, yy + h], [xx, yy + h, xx + w, yy + h], [xx, yy, xx, yy + h]];
      style.border.forEach((border, i) => { if (border) { const e = edges[i]; pdf.lineWidth(border === "medium" ? .8 : .4).strokeColor("#000000").moveTo(e[0], e[1]).lineTo(e[2], e[3]).stroke(); } });
      if (!text) continue;
      const size = style.size * scale, inset = (2 + style.indent * 6) * scale, innerWidth = w - inset - 2 * scale;
      pdf.font(face(style)).fontSize(size).fillColor(`#${style.color}`);
      const horizontalScale = cell.horizontalScale;
      const th = pdf.heightOfString(text, { width: innerWidth / horizontalScale, lineGap: 0 });
      const ty = yy + (style.vertical === "top" ? 2 * scale : style.vertical === "center" ? Math.max(2 * scale, (h - th) / 2) : Math.max(2 * scale, h - th - 2 * scale));
      pdf.save().translate(xx + inset, ty).scale(horizontalScale, 1);
      pdf.text(text, 0, 0, { width: innerWidth / horizontalScale, lineGap: 0, underline: style.underline, align: style.align === "center" ? "center" : style.align === "right" ? "right" : "left" });
      pdf.restore();
    }
    y = next;
  }
  page();
  const headerRows = sheet.widths.length === 6 ? [1, 2, 3, 4, 5] : sheet.id === "perhitungan" ? [] : [1, 2, 3, 4, 5, 6];
  for (const rows of groups) {
    const h = rows.reduce((n, r) => n + heights[r - 1], 0);
    if (y + h > height - bottom && y > top) { page(); if (rows[0] > (headerRows.at(-1) ?? 0)) draw(headerRows); }
    draw(rows);
  }
  if (sheet.id === "usulan" || sheet.id === "penempatan") {
    const text = sheet.id === "usulan" ? `TOTAL SEMUA JABATAN: ABK ${number(result.total.need!)} | Usulan ${number(result.total.proposed!)} (PNS ${number(result.total.proposedPns!)}, PPPK ${number(result.total.proposedPppk!)}) | Bezetting ${number(result.total.existing!)} | Kekurangan ${number(result.total.shortage!)}` : `TOTAL PENEMPATAN: ${number(result.total.placed!)} (PNS ${number(result.total.placedPns!)}, PPPK ${number(result.total.placedPppk!)})`;
    if (y + 35 > height - bottom) page();
    pdf.font("Helvetica-Bold").fontSize(8).fillColor("#000000").text(text, side, y + 10, { width: width - side * 2 });
  }
}

function drawOutputs(pdf: PDFKit.PDFDocument, level: SourceLevel, year: number) {
  const tasks = level.tasks.filter(t => t.output); if (!tasks.length) return;
  let y = 0;
  const header = () => { pdf.addPage({ size: "A4", margin: 0 }); pdf.font("Helvetica-Bold").fontSize(11).fillColor("#000000").text(`HASIL KERJA - ANALIS PSP ${level.grade.toUpperCase()}`, 24, 40, { width: 547, align: "center" }); pdf.font("Helvetica").fontSize(8).text(`Tahun ${year} | Keterangan kolom H pada sheet ${level.sheet}`, 24, 61, { width: 547, align: "center" }); y = 87; };
  header();
  for (const task of tasks) {
    const text = `${task.description}\nHasil kerja: ${task.output}`;
    pdf.font("Helvetica").fontSize(9); const h = pdf.heightOfString(text, { width: 505 }) + 10;
    if (y + h > 790) header();
    pdf.rect(24, y, 547, h).lineWidth(.4).strokeColor("#000000").stroke();
    pdf.font("Helvetica").fontSize(8).text(String(task.row), 28, y + 7, { width: 25 });
    pdf.fontSize(9).text(text, 60, y + 7, { width: 505 }); y += h;
  }
}

export async function createAnjabPdf(year: number, plan: AnjabPlan, catalog: SourceCatalog, selection: AnjabPdfSelection) {
  const sheets = anjabPdfSheets(plan, catalog, selection), result = calculateAnjab(plan, catalog);
  const pdf = new PDFDocument({ autoFirstPage: false, bufferPages: true, info: { Title: `Anjab-ABK ${year}`, Author: "DKPP Kabupaten Indramayu" } });
  const chunks: Buffer[] = []; pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => { pdf.on("end", () => resolve(Buffer.concat(chunks))); pdf.on("error", reject); });
  for (const sheet of sheets) {
    drawSheet(pdf, sheet, year, result);
    const level = catalog.families.flatMap(f => f.levels).find(l => l.id === sheet.id);
    if (level) drawOutputs(pdf, level, year);
  }
  const pages = pdf.bufferedPageRange().count;
  for (let i = 0; i < pages; i++) { pdf.switchToPage(i); pdf.font("Helvetica").fontSize(7).fillColor("#555555").text(`Anjab-ABK ${year} | Halaman ${i + 1} dari ${pages}`, 18, pdf.page.height - 24, { width: pdf.page.width - 36, align: "right" }); }
  pdf.end(); return completed;
}
