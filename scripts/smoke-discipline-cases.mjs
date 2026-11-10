import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import Database from "better-sqlite3";
import PizZip from "pizzip";
import ts from "typescript";

const require = createRequire(import.meta.url);
const db = new Database(":memory:");
db.pragma("foreign_keys=ON");
db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY);
  INSERT INTO users VALUES ('test-user');
  CREATE TABLE employees(nip TEXT PRIMARY KEY,name TEXT,rank TEXT,position TEXT,unit TEXT,asn_type TEXT,status TEXT);
  INSERT INTO employees VALUES ('199001012020121099','Pegawai Uji & Pemeriksaan','Penata III/c','Analis Kebijakan','Bidang Contoh','PNS','Aktif'),
    ('199002012020121099','Pegawai PPPK','IX','Pelaksana','Bidang Contoh','PPPK','Aktif');`);
const source = readFileSync("src/lib/db.ts", "utf8");
db.exec(source.match(/CREATE TABLE IF NOT EXISTS discipline_cases \([\s\S]*?CREATE INDEX IF NOT EXISTS discipline_cases_actor_idx[^;]+;/)[0]);
const database = { prepare(sql) {
  const statement = db.prepare(sql);
  return { run: async (...args) => statement.run(...args), get: async (...args) => statement.get(...args), all: async (...args) => statement.all(...args) };
} };
let access = "allowed";
const modules = new Map();
function load(file) {
  const filename = path.resolve(file);
  if (modules.has(filename)) return modules.get(filename).exports;
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  modules.set(filename, mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name === "@/lib/database") return { database };
    if (name === "@/lib/authorization") return { checkApiAccess: async menus => {
      assert.deepEqual(menus, ["penjatuhan-hukdis"]);
      return access === "allowed" ? null : Response.json({}, { status: access === "signed-out" ? 401 : 403 });
    } };
    if (name === "@/lib/session") return { getCurrentUser: async () => ({ id: "test-user" }) };
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const { classifyDisciplineAbsence, emptyDisciplineCase, disciplineCaseSchema, disciplineCaseStatus } = load("src/lib/discipline-case.ts");
const { POST } = load("src/app/api/penjatuhan-hukdis/route.ts");
const { PATCH } = load("src/app/api/penjatuhan-hukdis/[id]/route.ts");
const { GET } = load("src/app/api/penjatuhan-hukdis/[id]/dokumen/[kind]/route.ts");
const url = "http://localhost/api/penjatuhan-hukdis";
const context = (id, kind) => ({ params: Promise.resolve({ id, kind }) });
const request = (values, version, method = "POST") => new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values, version }) });
const download = (record, kind) => GET(new Request(url), context(record.id, kind));
const create = async values => {
  const response = await POST(request(values));
  assert.equal(response.status, 201, await response.clone().text());
  return (await response.json()).record;
};
const official = { name: "Pemeriksa Contoh", nip: "198001012005011099", rank: "Pembina IV/a", position: "Kepala Bidang Contoh" };
const authority = { ...official, name: "Pejabat Penetap Contoh", nip: "197801012000121099", position: "Kepala Dinas Contoh" };
const base = {
  ...structuredClone(emptyDisciplineCase), employeeNip: "199001012020121099", absenceDays: 4, examiner: official, authority,
};
for (const [days, level, provision] of [
  [1, "", "Pasal 4 huruf f"], [2, "", "Pasal 4 huruf f"],
  [3, "Ringan", "Pasal 9 ayat (2) huruf b angka 1"],
  [4, "Ringan", "Pasal 9 ayat (2) huruf b angka 2"], [6, "Ringan", "Pasal 9 ayat (2) huruf b angka 2"],
  [7, "Ringan", "Pasal 9 ayat (2) huruf b angka 3"], [10, "Ringan", "Pasal 9 ayat (2) huruf b angka 3"],
  [11, "Sedang", "Pasal 10 ayat (2) huruf f angka 1"], [13, "Sedang", "Pasal 10 ayat (2) huruf f angka 1"],
  [14, "Sedang", "Pasal 10 ayat (2) huruf f angka 2"], [16, "Sedang", "Pasal 10 ayat (2) huruf f angka 2"],
  [17, "Sedang", "Pasal 10 ayat (2) huruf f angka 3"], [20, "Sedang", "Pasal 10 ayat (2) huruf f angka 3"],
  [21, "Berat", "Pasal 11 ayat (2) huruf d angka 1"], [24, "Berat", "Pasal 11 ayat (2) huruf d angka 1"],
  [25, "Berat", "Pasal 11 ayat (2) huruf d angka 2"], [27, "Berat", "Pasal 11 ayat (2) huruf d angka 2"],
  [28, "Berat", "Pasal 11 ayat (2) huruf d angka 3"], [366, "Berat", "Pasal 11 ayat (2) huruf d angka 3"],
]) {
  const result = classifyDisciplineAbsence(days, false);
  assert.equal(result.level, level, days);
  assert(result.provision.endsWith(provision), days);
}
assert.equal(classifyDisciplineAbsence(10, true).level, "Berat");
assert(classifyDisciplineAbsence(10, true).provision.endsWith("Pasal 11 ayat (2) huruf d angka 4"));
assert(!classifyDisciplineAbsence(9, true));
assert(!classifyDisciplineAbsence(4.5, false));
assert(!classifyDisciplineAbsence(367, false));
const save = (record, values, version = record.version) => PATCH(request(values, version, "PATCH"), context(record.id));
access = "signed-out";
assert.equal((await POST(request(base))).status, 401);
access = "forbidden";
assert.equal((await POST(request(base))).status, 403);
access = "allowed";
assert.equal((await POST(request({ ...base, employeeNip: "199002012020121099" }))).status, 422);
assert.equal((await POST(request({ ...base, absenceDays: undefined }))).status, 422);
assert.equal((await POST(request({ ...base, consecutiveAbsence: true }))).status, 422);
const draft = await create({ ...base, reference: "DITOLAK", level: "Berat", provision: "Pasal lain", allegation: "Teks lain", incidentDate: "2026-10-01", incidentPlace: "DKPP" });
assert.equal(draft.employee.name, "Pegawai Uji & Pemeriksaan");
assert.equal(draft.values.level, "Ringan");
assert(draft.values.provision.endsWith("Pasal 9 ayat (2) huruf b angka 2"));
assert.match(draft.values.allegation, /4 hari kerja/);
for (const field of ["reference", "incidentDate", "incidentPlace"]) assert.equal(draft.values[field], "");
assert.notEqual(draft.id, (await create(base)).id);
assert.equal((await download(draft, "panggilan-1")).status, 422);
const firstCall = { number: "800/101/UJI", letterDate: "2026-10-02", date: "2026-10-14", time: "09:00", place: "Ruang rapat DKPP", attendance: "hadir" };
const secondCall = { ...firstCall, number: "800/102/UJI", letterDate: "2026-10-15", date: "2026-10-27", place: "Ruang pemeriksaan lanjutan", attendance: "hadir" };
assert(!disciplineCaseSchema.safeParse({ ...base, secondCall }).success);
assert(disciplineCaseSchema.safeParse({ ...base, firstCall: { ...firstCall, attendance: "" }, secondCall }).success);
assert(!disciplineCaseSchema.safeParse({ ...base, firstCall, secondCall: { ...secondCall, letterDate: "2026-10-10" } }).success);
const sessions = {
  firstCall: { date: firstCall.date, place: firstCall.place, questions: "1. Tanya jawab sesi pertama.", signature: "ditandatangani" },
  secondCall: { date: secondCall.date, place: secondCall.place, questions: "1. Tanya jawab sesi kedua.", signature: "menolak" },
};
const caseData = { ...base, firstCall, secondCall,
  review: { ...base.review, sessions, outcome: "terbukti",
    findings: "tidak masuk kerja empat hari tanpa alasan sah", reportDate: "2026-10-28", recipient: "Pejabat tujuan laporan", recipientPlace: "Indramayu",
    aggravating: "Mengganggu penjadwalan layanan.", mitigating: "Kooperatif selama pemeriksaan.", impact: "Perlu pengalihan petugas.", recommendation: "Teguran tertulis" },
};
assert(!disciplineCaseSchema.safeParse({ ...caseData, review: { ...caseData.review, signature: "dua-kali-tidak-hadir" } }).success);
assert(!disciplineCaseSchema.safeParse({ ...caseData, review: { ...caseData.review, reportDate: firstCall.date } }).success);
assert(!disciplineCaseSchema.safeParse({ ...caseData, secondCall: { ...secondCall, attendance: "tidak-hadir" } }).success);
assert.equal(disciplineCaseStatus(caseData), "Hasil pemeriksaan tercatat");
const archivedDecision = { ...base.decision, number: "800/204/UJI", date: "2026-10-29", place: "Indramayu", sanction: "tertulis", issued: true };
const updated = await save(draft, { ...caseData, decision: archivedDecision });
assert.equal(updated.status, 200, await updated.clone().text());
const final = (await updated.json()).record;
assert.equal(final.version, 2);
assert.deepEqual(final.values.review.sessions, sessions);
assert.equal(final.values.decision.issued, false);
assert.equal(final.values.authority.name, "");
assert.equal((await save(draft, caseData)).status, 409);
for (const kind of ["lisan", "tertulis", "tidak-puas", "penerimaan"]) assert.equal((await download(final, kind)).status, 404);
access = "forbidden";
assert.equal((await download(final, "bap-2")).status, 403);
access = "allowed";

const evidenceData = { ...caseData, firstCall: { ...firstCall, attendance: "tidak-hadir" }, secondCall: { ...secondCall, attendance: "tidak-hadir" },
  review: { ...caseData.review, sessions: undefined, signature: "dua-kali-tidak-hadir", evidence: "Rekap absensi dan bukti pengiriman panggilan." } };
assert(!disciplineCaseSchema.safeParse({ ...evidenceData, review: { ...evidenceData.review, evidence: "" } }).success);
const evidence = await create(evidenceData);
assert.equal((await download(evidence, "bap-1")).status, 422);
assert.equal((await download(evidence, "panggilan-2")).status, 200);

const team = await create({ ...base, absenceDays: 10, consecutiveAbsence: true,
  team: { ...base.team, number: "800/301/UJI", date: "2026-10-02", issuer: authority,
    oversight: { ...official, name: "Unsur Pengawasan", position: "Auditor" },
    hr: { ...official, name: "Unsur Kepegawaian", position: "Analis SDM" } },
});
const legacy = { ...final, id: "10000000-0000-4000-8000-000000000099", version: 1, values: { ...caseData,
  firstCall: { ...firstCall, attendance: "tidak-hadir" },
  review: { ...caseData.review, ...sessions.secondCall, sessions: undefined },
  authority, decision: archivedDecision, absenceDays: undefined, reference: "UJI/ARSIP/2026", level: "Ringan", allegation: "Uraian lama",
  provision: "Pasal 4 huruf f", incidentDate: "2026-10-01", incidentPlace: "Kantor DKPP" } };
db.prepare(`INSERT INTO discipline_cases (id, employee_nip, employee_name, reference, reference_key, status, data_json, revision, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(legacy.id, legacy.employee.nip, legacy.employee.name, legacy.values.reference, "uji/arsip/2026",
  "Keputusan diterima", JSON.stringify({ employee: legacy.employee, values: legacy.values }), "2026-11-03", "2026-11-03");
const legacySaved = await save(legacy, { ...legacy.values, authority: undefined, decision: undefined });
assert.equal(legacySaved.status, 200);
assert.deepEqual((await legacySaved.json()).record.values.decision, archivedDecision);
assert.equal((await download(legacy, "bap-1")).status, 422);
assert.equal((await download(legacy, "bap-2")).status, 200);
assert.equal((await download(legacy, "bap")).status, 200);
assert.equal((await download(legacy, "laporan")).status, 200);
const output = ".tmp/hukdis-examination-output";
const write = process.argv.includes("--render-fixtures");
if (write) mkdirSync(output, { recursive: true });
for (const [record, kind, suffix] of [[final, "panggilan-1"], [final, "panggilan-2"], [team, "tim"], [final, "bap-1"], [final, "bap-2"],
  [final, "laporan"], [evidence, "laporan", "-bukti"]]) {
  const response = await download(record, kind);
  assert.equal(response.status, 200, response.status === 200 ? undefined : await response.text());
  assert.match(response.headers.get("content-disposition"), /Draf-/);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const bytes = Buffer.from(await response.arrayBuffer());
  const zip = new PizZip(bytes);
  assert(zip.file("word/media/dkpp-kop.png"));
  const xml = zip.file("word/document.xml").asText();
  const text = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map(match => match[1]).join("");
  assert(text.includes("DINAS KETAHANAN PANGAN DAN PERTANIAN") && text.includes("Pegawai Uji &amp; Pemeriksaan"), kind);
  assert(!/\{[a-z_]+\}/.test(xml) && !xml.includes("KOP PERANGKAT DAERAH"));
  if (kind === "panggilan-1") assert(text.includes("4 hari kerja secara kumulatif"));
  if (kind === "panggilan-2") assert(text.includes("PANGGILAN II (PEMERIKSAAN LANJUTAN)"));
  if (kind === "bap-1") assert(text.includes("sesi pertama") && !text.includes("sesi kedua") && text.includes("14 Oktober 2026"));
  if (kind === "bap-2") assert(text.includes("sesi kedua") && !text.includes("sesi pertama") && text.includes("27 Oktober 2026") && text.includes("tidak bersedia"));
  if (kind === "laporan") {
    assert(text.includes("HARIPOLA") && text.includes("4 hari kerja") && text.includes("Kumulatif"));
    if (suffix) assert(text.includes("Rekap absensi") && text.includes("ketidakhadiran pada kedua panggilan"));
    else assert(text.includes("14 Oktober 2026") && text.includes("27 Oktober 2026") && text.includes("bahan tindak lanjut sesuai kewenangan"));
  }
  if (write) writeFileSync(`${output}/${kind}${suffix ?? ""}.docx`, bytes);
}
db.close();
console.log("PASS Hukdis: Panggilan II setelah hadir, dua BAP terpisah, telaah bukti, laporan, akses, revisi, dan arsip lama.");
