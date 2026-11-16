import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import Module, { createRequire } from "node:module";
import path from "node:path";
import ExcelJS from "exceljs";
import ts from "typescript";

const require = createRequire(import.meta.url);
const cache = new Map();
let actor = null;
let reads = 0;
const original = { birthPlace: "Indramayu", jobPositionId: null, parentUnit: "DKPP", unit: "Unit Contoh", position: "Pelaksana",
  positionType: "JFU", echelon: "-", rank: "Pengatur II/c", asnType: "PNS", gender: "Perempuan", status: "Aktif",
  retirementAge: 58, createdAt: "2026-11-16", updatedAt: "2026-11-16" };
const employees = [
  { ...original, nip: "000123456789012345", name: "Pegawai Contoh" },
  { ...original, nip: "199001012020121099", name: "=1+1", retirementAge: null, status: "Mutasi", position: "Jabatan baris pertama\nBaris kedua" },
];

function load(file) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename);
  cache.set(filename, mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name === "next/navigation") return { redirect: () => { throw Error("Unexpected redirect"); } };
    if (name === "@/lib/session") return { getCurrentUser: async () => actor, requireUser: async () => actor };
    if (name === "@/lib/employees") return { getEmployees: async () => { reads++; return employees; } };
    if (name === "@/lib/plt-dates") return { jakartaToday: () => "2026-11-16" };
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}

const { POST } = load("src/app/api/employees/export/route.ts");
const request = body => new Request("http://localhost/api/employees/export", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
assert.equal((await POST(request({ nips: [employees[0].nip] }))).status, 401);
actor = { id: "tester", isAdministrator: false, menuPermissions: ["perpustakaan-buku"] };
assert.equal((await POST(request({ nips: [employees[0].nip] }))).status, 403);
actor = { ...actor, menuPermissions: ["pegawai"] };
for (const body of [null, {}, { nips: [] }, { nips: [123] }, { nips: [employees[0].nip, employees[0].nip] }]) {
  assert.equal((await POST(request(body))).status, 422);
}
assert.equal(reads, 0, "Requests without access or valid input must not read employees");
assert.equal((await POST(request({ nips: [employees[0].nip, "not-found"] }))).status, 409);

const response = await POST(request({ nips: [employees[1].nip, employees[0].nip], name: "Client-forged name" }));
assert.equal(response.status, 200);
assert.equal(response.headers.get("Cache-Control"), "private, no-store");
assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
assert.equal(response.headers.get("Content-Type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
assert.match(response.headers.get("Content-Disposition"), /Daftar-Pegawai-2026-11-16\.xlsx/);
const bytes = Buffer.from(await response.arrayBuffer());
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(bytes);
const sheet = workbook.getWorksheet("Daftar Pegawai");
assert.equal(sheet.actualRowCount, 5);
assert.equal(sheet.actualColumnCount, 14);
assert.equal(sheet.getCell("B4").value, employees[1].nip);
assert.equal(sheet.getCell("B5").value, employees[0].nip);
assert.equal(sheet.getCell("B5").type, ExcelJS.ValueType.String);
assert.equal(sheet.getCell("B5").numFmt, "@");
assert.equal(sheet.getCell("C4").value, "=1+1", "Names must remain literal strings");
assert.equal(sheet.getCell("C4").type, ExcelJS.ValueType.String);
assert.equal(sheet.getCell("H4").value, employees[1].position);
assert.equal(sheet.getCell("L4").value, null);
assert.equal(sheet.getCell("L5").value, 58);
assert.equal(sheet.getCell("N4").value, "Mutasi");
assert.equal(sheet.views[0].xSplit, 3);
assert.equal(sheet.views[0].ySplit, 3);
assert(sheet.autoFilter);
if (process.env.SMOKE_EMPLOYEE_EXPORT_FILE) await writeFile(process.env.SMOKE_EMPLOYEE_EXPORT_FILE, bytes);
console.log("PASS ekspor pegawai: izin menu, urutan pilihan, data server, 14 kolom, NIP teks, dan nama literal.");
