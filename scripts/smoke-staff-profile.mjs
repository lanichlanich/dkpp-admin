import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import PizZip from "pizzip";

const require = createRequire(import.meta.url), modules = new Map();
let actor = null, reads = 0, input;
function load(file) {
  const filename = path.resolve(file);
  if (filename.endsWith(".json")) return JSON.parse(readFileSync(filename, "utf8"));
  if (modules.has(filename)) return modules.get(filename).exports;
  const mod = new Module(filename); modules.set(filename, mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name === "react") return { cache: fn => fn };
    if (name === "next/navigation") return { redirect: () => { throw Error("Access denied"); } };
    if (name === "@/lib/session") return { getCurrentUser: async () => actor, requireUser: async () => { if (!actor) throw Error("Unauthenticated"); return actor; } };
    if (name === "@/lib/database") return { database: { prepare(sql) { return { all: async () => {
      reads++;
      if (sql.includes("FROM employees e LEFT")) return input.employees;
      if (sql.includes("FROM organization_units")) return input.units;
      if (sql.includes("FROM employee_documents")) return input.documents;
      if (sql.includes("FROM kgb_signed_documents")) return input.kgb;
      if (sql.includes("FROM plt_assignments p")) return input.acting;
      throw Error(`Unexpected query: ${sql}`);
    } }; } } };
    if (name === "@/lib/plt-dates") return { jakartaToday: () => "2026-11-17" };
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}${name.endsWith(".json") ? "" : ".ts"}`);
    return require(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, filename);
  return mod.exports;
}
const source = load("src/data/retirement-position-map-2026.json");
const { buildStaffProfile } = load("src/lib/staff-profile.ts");
const { createStaffProfilePdf, createStaffProfileDocx } = load("src/lib/staff-profile-export.ts");
const { getStaffProfileData } = load("src/lib/staff-profile-data.ts");
const { GET } = load("src/app/api/staff-profile/export/route.ts");
const job = source.positions[0];
const employee = { nip: "196905151990011001", name: "Uji & <Profil>", position: job.name, positionType: "JS", echelon: "II",
  unit: job.unit, asnType: "PNS", rank: "Pembina (IV/a)", status: "Aktif", gender: "Laki-laki", organizationUnitId: "child" };
input = { employees: [employee, { ...employee, nip: "invalid", name: "Tanpa NIP", organizationUnitId: null, unit: "Tidak cocok", rank: "", gender: "", position: "Belum tercatat" },
  { ...employee, nip: "197008101991012001", status: "Pensiun", name: "Tidak masuk lampiran aktif" }],
  units: [{ id: "root", name: "Dinas", parentId: null }, { id: "child", name: job.unit, parentId: "root" }],
  documents: [{ nip: employee.nip, type: "SK PNS", count: 2 }],
  kgb: [{ nip: employee.nip, tmt: "2024-12-01", count: 1 }],
  acting: [{ startDate: "2026-10-01", endDate: "2026-11-20", closedAt: null, nextStartDate: null }] };
const report = buildStaffProfile(input, "2026-11-17", 2027);
assert.deepEqual(report.summary, { active: 2, required: 253, mapped: 1, unmatched: 1, retirees: 1, documented: 1 });
const signedOnly = buildStaffProfile({ ...input, documents: [] }, "2026-11-17", 2027);
assert.equal(signedOnly.summary.documented, 1, "Linked signed KGB must count as an employee archive");
assert(JSON.stringify(signedOnly.sections[5]).includes("SK KGB Bertanda Tangan"));
assert.equal(report.sections.length, 10);
const unitTable = report.sections[1].blocks.find(b => b.type === "table");
assert.deepEqual(unitTable.rows, [["Dinas", "0", "1"], [job.unit, "1", "1"], ["Belum terhubung dengan master unit", "1", "1"]]);
const activeTable = report.sections[7].blocks.find(b => b.type === "table");
assert.equal(activeTable.rows.length, 2);
assert(!activeTable.rows.flat().includes("Tidak masuk lampiran aktif"));
const positions = report.sections[8].blocks.find(b => b.type === "table");
assert.equal(positions.rows.length, 179);
assert(positions.rows.some(r => Number(r[6]) < 0));
assert(positions.rows.some(r => Number(r[4]) === 0));
assert.equal(positions.rows.reduce((sum, row) => sum + Number(row[4]), 0), 253);
const docx = createStaffProfileDocx(report), zip = new PizZip(docx), documentXml = zip.file("word/document.xml").asText();
assert(documentXml.includes("Uji &amp; &lt;Profil&gt;"));
assert(documentXml.includes(employee.nip));
assert(!documentXml.includes("Jenis jabatan data pegawai berbeda"));
assert(zip.file("word/footer1.xml").asText().includes('w:instr="PAGE"'));
assert(documentXml.includes('w:orient="landscape"'));
const tableCount = report.sections.flatMap(s => s.blocks).filter(b => b.type === "table").length;
assert.equal((documentXml.match(/<w:tbl>/g) ?? []).length, tableCount);
assert.equal((documentXml.match(/<w:tblHeader\/>/g) ?? []).length, tableCount);
const pdf = await createStaffProfilePdf(report); assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
const empty = buildStaffProfile({ employees: [], units: [], documents: [], kgb: [], acting: [] }, "2026-11-17", 2027);
assert.equal(empty.summary.active, 0);
assert(!JSON.stringify(empty).includes("NaN"));
const cyclic = buildStaffProfile({ ...input, units: [{ id: "child", name: job.unit, parentId: "child" }] }, "2026-11-17", 2027);
assert.equal(cyclic.sections[1].blocks.find(b => b.type === "table").rows[0][2], "1");
const request = query => new Request(`http://localhost/api/staff-profile/export?${query}`);
assert.equal((await GET(request("format=pdf"))).status, 401);
actor = { isAdministrator: false, menuPermissions: ["pegawai"] };
assert.equal((await GET(request("format=docx"))).status, 403);
assert.equal(reads, 0, "Denied exports must not read employee data");
await assert.rejects(getStaffProfileData, /Access denied/);
actor = { isAdministrator: false, menuPermissions: ["profil-kepegawaian"] };
for (const query of ["format=xlsx", "format=pdf&startYear=2096", "format=pdf&startYear=2027.5", "format=docx&startYear=bad"]) {
  const response = await GET(request(query)); assert.equal(response.status, 422); assert.equal(response.headers.get("cache-control"), "private, no-store");
}
for (const format of ["pdf", "docx"]) {
  const response = await GET(request(`format=${format}&startYear=2027`)); assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("content-disposition"), new RegExp(`Profil-Kepegawaian-DKPP-2026-11-17\\.${format}`));
  assert((await response.arrayBuffer()).byteLength > 10000);
}
assert.equal(reads, 10, "The new menu permission alone must permit all report data reads");
if (process.argv[2]) {
  const fixture = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const real = buildStaffProfile(fixture, "2026-11-17", 2027);
  mkdirSync(".tmp/staff-profile", { recursive: true });
  writeFileSync(".tmp/staff-profile/profile.pdf", await createStaffProfilePdf(real));
  writeFileSync(".tmp/staff-profile/profile.docx", createStaffProfileDocx(real));
  writeFileSync(".tmp/staff-profile/model.json", JSON.stringify(real));
  console.log("Snapshot report:", real.summary);
}
console.log("Staff profile: authorization, active-only totals, hierarchy, complete appendices, signed gaps, empty data, escaped DOCX, PDF and API exports passed.");
