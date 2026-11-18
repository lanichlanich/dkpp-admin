import { z } from "zod";
import source from "@/data/retirement-position-map-2026.json";
import reference from "@/data/position-map-reference.json";
import { buildRetirementProjection, normalizeProjectionUnit, type ProjectionEmployee, type PositionRequirement } from "@/lib/retirement-projection";
import { buildProjectionHierarchy } from "@/lib/retirement-projection-hierarchy";

export const positionMapCatalog: PositionRequirement[] = [...source.positions, ...reference.additionalPositions];
export const positionMapHierarchy = buildProjectionHierarchy(positionMapCatalog);
export const positionMapIds = new Set(positionMapCatalog.map(row => row.id));
export type PositionMapValue = { required: number; staffed: number };
export type PositionMapPlan = { positions: Record<string, PositionMapValue> };
export type PositionMapRecord = { year: number; plan: PositionMapPlan; revision: number; updatedAt: string | null };
const amount = z.number().int("Jumlah harus berupa bilangan bulat.").min(0).max(999, "Jumlah maksimal 999.");
export const positionMapPlanSchema = z.object({ positions: z.record(z.string(), z.object({ required: amount, staffed: amount }).strict())
  .refine(rows => Object.keys(rows).length === positionMapIds.size && [...positionMapIds].every(id => Object.hasOwn(rows, id)),
    "Daftar jabatan harus lengkap dan sesuai katalog peta jabatan.") }).strict();
export const validMapYear = (year: number) => Number.isInteger(year) && year >= 2000 && year <= 2099;
const normalize = normalizeProjectionUnit;
export function currentPositionMapStaff(employees: ProjectionEmployee[], today: string) {
  const projection = buildRetirementProjection(positionMapCatalog, employees,
    { startYear: Number(today.slice(0, 4)), kind: "all", unit: "", asn: "all", search: "" }, today);
  return { counts: Object.fromEntries(projection.rows.map(row => [row.id, row.active])),
    active: projection.employees.length, mapped: projection.mappedActive, unmapped: projection.unmapped };
}
export function defaultPositionMapPlan(counts: Record<string, number>): PositionMapPlan {
  const required = new Map(reference.tables.flatMap(table => table.rows.map(row => [row.id, row.required] as const)));
  return { positions: Object.fromEntries(positionMapCatalog.map(row => [row.id, { required: required.get(row.id) ?? row.required, staffed: counts[row.id] ?? 0 }])) };
}
export function positionMapSummary(plan: PositionMapPlan) {
  const values = Object.values(plan.positions);
  const required = values.reduce((n, row) => n + row.required, 0), staffed = values.reduce((n, row) => n + row.staffed, 0);
  return { required, staffed, balance: staffed - required,
    shortage: -values.reduce((n, row) => n + Math.max(0, row.required - row.staffed), 0),
    surplus: values.reduce((n, row) => n + Math.max(0, row.staffed - row.required), 0) };
}
export const positionMapIsUptd = (unit: string) => normalize(unit).startsWith("UPTD ") || normalize(unit).startsWith("SUB BAGIAN TATA USAHA UPTD ");

export type MapRect = { x: number; y: number; width: number; height: number; color: string };
export type MapTable = { x: number; y: number; width: number; columns: number[]; heights: number[]; rows: string[][];
  fontSize: number; header?: boolean; fill?: string; borders?: boolean; centered?: boolean; roleIds: string[] };
export type MapLabel = { x: number; y: number; width: number; text: string; size: number; bold?: boolean };
export type PositionMapPage = { title: string; width: number; height: number; rects: MapRect[]; tables: MapTable[]; labels: MapLabel[] };
const wrap = (text: string, width: number, size: number) => {
  const limit = Math.max(12, Math.floor(width / (size * .5))), lines: string[] = [];
  for (const word of text.toUpperCase().replace(/\s+-\s*$/, "").split(/\s+/)) {
    if (!lines.length || `${lines.at(-1)} ${word}`.length > limit) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  return lines.join("\n");
};
const countsLabel = (plan: PositionMapPlan, id: string) => {
  const row = plan.positions[id]; return `K: ${row.required}     B: ${row.staffed}     +/-: ${row.staffed - row.required}`;
};
export function buildPositionMapPages(plan: PositionMapPlan, year: number): PositionMapPage[] {
  const width = reference.width, height = reference.height;
  // Replace the PDF's table grids with editable Word tables. Keep its heading
  // backgrounds and connecting lines at their original page coordinates.
  const rects = reference.rects.filter(rect => !reference.tables.some(table => rect.x >= table.x - .7 && rect.x + rect.width <= table.x + table.width + .7
    && rect.y >= table.y - .7 && rect.y + rect.height <= table.y + table.rowHeights.reduce((n, h) => n + h, 0) + .7));
  const first: PositionMapPage = { title: "Peta Jabatan Dinas", width, height, rects, tables: [], labels: [] };
  const included = new Set(reference.heads.flatMap(head => head.id ? [head.id] : []));
  reference.tables.forEach(table => table.rows.forEach(row => included.add(row.id)));
  for (const head of reference.heads) {
    const colorHeight = head.height - 10.08;
    first.tables.push({ x: head.x, y: head.y, width: head.width, columns: [head.width], heights: [colorHeight, 10.08],
      rows: [[wrap(head.name, head.width - 4, 6.5)], [head.id ? countsLabel(plan, head.id) : ""]], fontSize: 6.5, centered: true, roleIds: head.id ? [head.id] : [] });
  }
  for (const table of reference.tables) {
    const additional = positionMapCatalog.filter(row => !included.has(row.id) && normalize(row.unit) === normalize(table.unit) && !positionMapIsUptd(row.unit));
    additional.forEach(row => included.add(row.id));
    const rows = [...table.rows.map(row => ({ id: row.id, label: wrap(row.label.replaceAll("\n", " "), table.columns[0] - 3, 6.5) })), ...additional.map(row => ({ id: row.id, label: wrap(row.name, table.columns[0] - 3, 6.5) }))];
    first.tables.push({ x: table.x, y: table.y, width: table.width, columns: table.columns,
      heights: [...table.rowHeights, ...additional.map(() => 20.16)],
      rows: [["Jabatan", "K", "B", "+/-"], ...rows.map(row => { const value = plan.positions[row.id]; return [row.label, String(value.required), String(value.staffed), String(value.staffed - value.required)]; })],
      fontSize: 6.5, header: true, borders: true, roleIds: rows.map(row => row.id) });
  }
  first.labels.push({ x: 562, y: 753, width: 112, text: "UPTD", size: 11.5, bold: true });
  const pages = [first];
  const uptd = positionMapHierarchy.positions.filter(node => node.position.kind === "Struktural" && normalize(node.position.unit).startsWith("UPTD "));
  const headBox = (page: PositionMapPage, id: string, x: number, y: number, w: number, color: string, size: number) => {
    const row = positionMapCatalog.find(p => p.id === id)!;
    page.tables.push({ x, y, width: w, columns: [w], heights: [35, 16], rows: [[wrap(row.name, w - 8, size)], [countsLabel(plan, id)]], fontSize: size, fill: color, borders: true, centered: true, roleIds: [id] });
  };
  const staffTable = (page: PositionMapPage, members: PositionRequirement[], x: number, y: number, w: number, size: number) => {
    if (!members.length) return;
    const columns = [w - 72, 24, 24, 24];
    const labels = members.map(row => wrap(row.name, columns[0] - 6, size));
    page.tables.push({ x, y, width: w, columns, heights: [20, ...labels.map(label => Math.max(23, label.split("\n").length * (size + 1.5) + 7))],
      rows: [["Jabatan", "K", "B", "+/-"], ...members.map((row, i) => { const value = plan.positions[row.id]; return [labels[i], String(value.required), String(value.staffed), String(value.staffed - value.required)]; })],
      fontSize: size, header: true, borders: true, roleIds: members.map(row => row.id) });
  };
  for (let i = 0; i < uptd.length; i++) {
    if (i % 6 === 0) pages.push({ title: `Rincian Peta Jabatan UPTD ${Math.floor(i / 6) + 1}`, width, height, rects: [], tables: [], labels: [
      { x: 40, y: 28, width: width - 80, text: "PETA JABATAN UNIT PELAKSANA TEKNIS DAERAH", size: 12, bold: true },
      { x: 40, y: 48, width: width - 80, text: `DINAS KETAHANAN PANGAN DAN PERTANIAN KABUPATEN INDRAMAYU TAHUN ${year}`, size: 10 },
    ] });
    const page = pages.at(-1)!, node = uptd[i], x = 42 + (i % 3) * 373, y = 90 + Math.floor((i % 6) / 3) * 350, w = 359;
    headBox(page, node.position.id, x, y, w, "00B050", 8.5);
    const direct = positionMapHierarchy.positions.filter(child => child.parentId === node.position.id);
    const tu = direct.find(child => child.position.kind === "Struktural"), members = direct.filter(child => child !== tu).map(child => child.position);
    const line = (x1: number, y1: number, x2: number, y2: number) => page.rects.push({ x: x1, y: y1, width: Math.max(.6, x2 - x1), height: Math.max(.6, y2 - y1), color: "000000" });
    line(x + w / 2, y + 51, x + w / 2, y + 65);
    if (!tu) staffTable(page, members, x, y + 65, w, 8.5);
    else if (!members.length) {
      headBox(page, tu.position.id, x, y + 65, w, "00B0F0", 8.5);
      line(x + w / 2, y + 116, x + w / 2, y + 130);
      staffTable(page, positionMapHierarchy.positions.filter(child => child.parentId === tu.position.id).map(child => child.position), x, y + 130, w, 8.5);
    } else {
      const half = (w - 12) / 2;
      line(x + half / 2, y + 65, x + half * 1.5 + 12, y + 65);
      line(x + half / 2, y + 65, x + half / 2, y + 77);
      line(x + half * 1.5 + 12, y + 65, x + half * 1.5 + 12, y + 77);
      staffTable(page, members, x, y + 77, half, 7);
      headBox(page, tu.position.id, x + half + 12, y + 77, half, "00B0F0", 7);
      line(x + half * 1.5 + 12, y + 128, x + half * 1.5 + 12, y + 142);
      staffTable(page, positionMapHierarchy.positions.filter(child => child.parentId === tu.position.id).map(child => child.position), x + half + 12, y + 142, half, 7);
    }
  }
  pages.forEach((page, i) => page.labels.push({ x: 40, y: height - 28, width: width - 80,
    text: `K = Kebutuhan    B = Bezetting    +/- = B - K    |    Tahun ${year}    |    Halaman ${i + 1} dari ${pages.length}`, size: 8 }));
  return pages;
}
