import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import ExcelJS from "exceljs";
import ts from "typescript";

const require = createRequire(import.meta.url), cache = new Map();
let actor = null, reads = 0;
let employees = [];
function load(file) {
  const filename = path.resolve(file);
  if (filename.endsWith(".json")) return JSON.parse(readFileSync(filename, "utf8"));
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); cache.set(filename, mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name === "next/navigation") return { redirect: () => { throw Error("Unexpected redirect"); } };
    if (name === "@/lib/session") return { getCurrentUser: async () => actor, requireUser: async () => actor };
    if (name === "@/lib/retirement-projection-data") return { getProjectionEmployees: async () => { reads++; return employees; } };
    if (name === "@/lib/plt-dates") return { jakartaToday: () => "2026-11-17" };
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}${name.endsWith(".json") ? "" : ".ts"}`);
    return require(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const source = load("src/data/retirement-position-map-2026.json");
const { buildRetirementProjection, normalizePosition } = load("src/lib/retirement-projection.ts");
assert.equal(source.positions.length, 179);
assert.equal(source.positions.reduce((n, row) => n + row.required, 0), 253);
for (const [kind, count] of [["Fungsional", 108], ["Pelaksana", 97], ["Struktural", 48]]) {
  assert.equal(source.positions.filter(row => row.kind === kind).reduce((n, row) => n + row.required, 0), count);
}
assert.equal(source.positions.filter(row => row.required === 0).length, 5);
assert.equal(source.positions.filter(row => row.sourceRow === "Tanpa nomor").length, 3);
assert(source.positions.some(row => row.sourceRow === "100" && row.name.endsWith("LOHBENER")));
assert(source.positions.some(row => row.sourceRow === "108" && row.name.endsWith("KRANGKENG")));
assert.equal(new Set(source.positions.map(row => `${normalizePosition(row.name)}|${row.unit}`)).size, 179);
const requirements = source.positions.filter(row => row.name === "Pengolah Data Dan Informasi").slice(0, 2);
assert.equal(requirements.length, 2);
const employee = (birth, row, extra = {}) => ({ nip: `${birth}2000011001`, name: `Pegawai ${birth}`, position: row.name,
  positionType: "JFU", echelon: "NON", unit: row.unit, asnType: "PNS", rank: "II/c", status: "Aktif", ...extra });
const filters = { startYear: 2027, kind: "all", unit: "", asn: "all", search: "" };
employees = [employee("19681215", requirements[0], { name: "=1+1" }), employee("19731130", requirements[0]),
  employee("19731215", requirements[0]), employee("19681115", requirements[0]),
  employee("19681015", requirements[0]), employee("19900230", requirements[0]),
  employee("19690201", requirements[0], { unit: "Unit di luar peta" }),
  employee("19690501", requirements[1], { status: "Mutasi" })];
const p = buildRetirementProjection(requirements, employees, filters, "2026-11-17");
assert.deepEqual(p.years, [2027, 2028, 2029, 2030, 2031]);
assert.equal(p.employees.length, 7, "Inactive staff excluded");
assert.equal(p.retirees.length, 3, "Both window edges included; Jan2032 excluded; unmapped retained");
assert.equal(p.retirees[0].retirementTmt, "2027-01-01", "December birth advances TMT year");
assert.equal(p.rows[0].retirements[4], 1, "December2031 TMT included");
assert.equal(p.rows[0].remaining[4], 2, "Before-period departures removed; unknown TMT remains explicit");
assert.equal(p.rows[1].active, 0, "No assignment across units with same position name");
assert.equal(p.rows[1].shortage[4], requirements[1].required, "Vacant placements remain visible");
assert.equal(p.summaries.find(g => g.kind === "Pelaksana").shortage[0], requirements[1].required,
  "Surplus in one unit must not cancel shortages in a different unit");
assert.equal(p.unmapped, 1); assert.equal(p.unknownDates, 1); assert.equal(p.beforePeriod, 2);
assert(p.review.some(e => e.issues.some(issue => issue.includes("sudah lewat"))));
assert.equal(buildRetirementProjection(requirements, employees, { ...filters, unit: requirements[1].unit }, "2026-11-17").employees.length, 0);
assert.equal(buildRetirementProjection(requirements, employees, { ...filters, asn: "PPPK" }, "2026-11-17").retirees.length, 0);
const functional = source.positions.find(row => row.name === "JF Perencana Ahli Pertama");
const alias = buildRetirementProjection([functional], [employee("19681215", functional, { position: "AHLI PERTAMA - PERENCANA" })], filters, "2026-11-17");
assert.equal(alias.mappedActive, 1); assert.equal(alias.employees[0].kind, "Fungsional");
assert(alias.review[0].issues.some(issue => issue.includes("Jenis jabatan")));
const chief = source.positions[0];
assert.equal(buildRetirementProjection([chief], [employee("19661215", chief, { positionType: "JS", echelon: "II.b" })], filters, "2026-11-17").retirees[0].retirementAge, 60);
const { GET } = load("src/app/api/retirement-projection/export/route.ts");
const req = query => new Request(`http://localhost/api/retirement-projection/export?${query}`);
assert.equal((await GET(req("format=xlsx&startYear=2027"))).status, 401);
actor = { isAdministrator: false, menuPermissions: ["pegawai"] };
assert.equal((await GET(req("format=pdf&startYear=2027"))).status, 403);
assert.equal(reads, 0, "No employee reads before access check");
actor.menuPermissions = ["proyeksi-pensiun"];
for (const q of ["format=csv&startYear=2027", "format=xlsx&startYear=2096", "format=pdf&startYear=abc", "format=pdf&startYear=2027&kind=bad"]) {
  assert.equal((await GET(req(q))).status, 422);
}
mkdirSync(".tmp/retirement-projection", { recursive: true });
const xlsx = await GET(req("format=xlsx&startYear=2027"));
assert.equal(xlsx.status, 200); assert.equal(xlsx.headers.get("cache-control"), "private, no-store");
const bytes = Buffer.from(await xlsx.arrayBuffer());
const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ["Ringkasan", "Rekap Jabatan", "Pegawai Pensiun", "Perlu Verifikasi"]);
const details = workbook.getWorksheet("Pegawai Pensiun");
assert.equal(details.getCell("B5").value, employees[0].nip); assert.equal(details.getCell("B5").type, ExcelJS.ValueType.String);
assert.equal(details.getCell("B5").numFmt, "@"); assert.equal(details.getCell("C5").value, "=1+1");
assert.equal(details.getCell("C5").type, ExcelJS.ValueType.String);
const pdf = await GET(req("format=pdf&startYear=2027"));
assert.equal(pdf.status, 200); assert.equal(pdf.headers.get("content-type"), "application/pdf");
const pdfBytes = Buffer.from(await pdf.arrayBuffer()); assert.equal(pdfBytes.subarray(0, 5).toString(), "%PDF-");
writeFileSync(".tmp/retirement-projection/sample.xlsx", bytes); writeFileSync(".tmp/retirement-projection/sample.pdf", pdfBytes);
console.log("PASS proyeksi: 179 penempatan/253 kebutuhan, periode/TMT, alias jenjang, unit terpisah, ASN, data belum pasti, izin API, NIP teks, dan ekspor Excel/PDF.");
if (process.env.SMOKE_RETIREMENT_EMPLOYEES) {
  employees = JSON.parse(readFileSync(process.env.SMOKE_RETIREMENT_EMPLOYEES, "utf8"));
  const real = buildRetirementProjection(source.positions, employees, filters, "2026-11-17");
  assert.equal(real.mappedActive + real.unmapped, real.employees.length);
  assert.equal(real.rows.reduce((n, row) => n + row.active, 0), real.mappedActive);
  for (const format of ["xlsx", "pdf"]) {
    const response = await GET(req(`format=${format}&startYear=2027`)); assert.equal(response.status, 200);
    writeFileSync(`.tmp/retirement-projection/production-snapshot.${format}`, Buffer.from(await response.arrayBuffer()));
  }
  console.log(JSON.stringify({ active: real.employees.length, mapped: real.mappedActive, unmapped: real.unmapped,
    retirees: real.retirees.length, review: real.review.length, unknownDates: real.unknownDates,
    unmappedPositions: real.employees.filter(e => !e.requirementId).map(e => ({ position: e.position, unit: e.unit })) }, null, 2));
}
