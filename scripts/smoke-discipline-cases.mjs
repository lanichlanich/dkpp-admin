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
const { emptyDisciplineCase, disciplineCaseSchema, disciplineCaseStatus } = load("src/lib/discipline-case.ts");
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
  ...structuredClone(emptyDisciplineCase), reference: "UJI/01/2026", employeeNip: "199001012020121099",
  allegation: "Ketidakhadiran tanpa alasan sah selama empat hari kerja.", provision: "Pasal 4 huruf f", incidentDate: "2026-10-01", incidentPlace: "Kantor DKPP",
  level: "Ringan", examiner: official, authority,
};
const save = (record, values, version = record.version) => PATCH(request(values, version, "PATCH"), context(record.id));
access = "signed-out";
assert.equal((await POST(request(base))).status, 401);
access = "forbidden";
assert.equal((await POST(request(base))).status, 403);
access = "allowed";
assert.equal((await POST(request({ ...base, employeeNip: "199002012020121099" }))).status, 422);
const draft = await create(base);
assert.equal(draft.employee.name, "Pegawai Uji & Pemeriksaan");
assert.equal((await POST(request({ ...base, reference: "uji/01/2026" }))).status, 409);
assert.equal((await download(draft, "panggilan-1")).status, 422);
const firstCall = { number: "800/101/UJI", letterDate: "2026-10-02", date: "2026-10-14", time: "09:00", place: "Ruang rapat DKPP", attendance: "tidak-hadir" };
const secondCall = { ...firstCall, number: "800/102/UJI", letterDate: "2026-10-15", date: "2026-10-27", attendance: "hadir" };
assert(!disciplineCaseSchema.safeParse({ ...base, secondCall }).success);
const caseData = { ...base, firstCall, secondCall,
  review: { ...base.review, date: "2026-10-27", signature: "ditandatangani", outcome: "terbukti", place: "Ruang rapat DKPP",
    questions: "1. Pertanyaan: Kapan Saudara tidak hadir?\nJawaban: Pada awal Oktober.\n2. Pertanyaan: Apakah izin sudah diajukan?\nJawaban: Belum.",
    findings: "tidak masuk kerja empat hari tanpa alasan sah", reportDate: "2026-10-28", recipient: "Kepala Dinas Contoh", recipientPlace: "Indramayu",
    aggravating: "Mengganggu penjadwalan layanan.", mitigating: "Kooperatif selama pemeriksaan.", impact: "Perlu pengalihan petugas.", recommendation: "Teguran tertulis" },
  decision: { ...base.decision, number: "800/204/UJI", date: "2026-10-29", place: "Indramayu", sanction: "tertulis", issued: true,
    consideration: "dampak pada jadwal unit kerja telah dipertimbangkan", extraBasis: "Dasar penunjukan pejabat yang berwenang Nomor UJI/2026",
    delivery: { date: "2026-11-02", time: "09:00", place: "Ruang rapat DKPP", letterDate: "2026-10-30", recipientPlace: "Indramayu" },
    sent: "2026-11-02", received: "2026-11-02" },
};
assert(!disciplineCaseSchema.safeParse({ ...caseData, review: { ...caseData.review, signature: "dua-kali-tidak-hadir" } }).success);
assert(!disciplineCaseSchema.safeParse({ ...caseData, level: "Berat", decision: { ...caseData.decision, sanction: "turun-jabatan" } }).success);
assert(!disciplineCaseSchema.safeParse({ ...caseData, decision: { ...caseData.decision, appeal: "keberatan", appealDate: "2026-11-03", effective: "2026-11-23" } }).success);
assert.equal(disciplineCaseStatus({ ...caseData, decision: { ...caseData.decision, appeal: "keberatan" } }), "Upaya administratif");
const updated = await save(draft, caseData);
assert.equal(updated.status, 200, await updated.clone().text());
const final = (await updated.json()).record;
assert.equal(final.version, 2);
assert.equal((await save(draft, caseData)).status, 409);
assert.equal((await save(final, { ...caseData, decision: { ...caseData.decision, issued: false, sent: "", received: "" } })).status, 409);
assert.equal((await download(final, "lisan")).status, 422);
access = "forbidden";
assert.equal((await download(final, "tertulis")).status, 403);
access = "allowed";

const team = await create({ ...base, reference: "UJI/TIM/2026", level: "Berat",
  team: { ...base.team, number: "800/301/UJI", date: "2026-10-02", issuer: authority,
    oversight: { ...official, name: "Unsur Pengawasan", position: "Auditor" },
    hr: { ...official, name: "Unsur Kepegawaian", position: "Analis SDM" } },
});
const verbal = await create({ ...caseData, reference: "UJI/LISAN/2026", decision: { ...caseData.decision, sanction: "lisan" } });
const dissatisfaction = await create({ ...caseData, reference: "UJI/TIDAK-PUAS/2026", decision: { ...caseData.decision, sanction: "tidak-puas" } });
const output = ".tmp/hukdis-output";
const write = process.argv.includes("--render-fixtures");
if (write) mkdirSync(output, { recursive: true });
for (const [record, kind] of [[final, "panggilan-1"], [final, "panggilan-2"], [team, "tim"], [final, "bap"], [final, "laporan"],
  [verbal, "lisan"], [final, "tertulis"], [dissatisfaction, "tidak-puas"], [final, "penerimaan"]]) {
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
  if (["lisan", "tertulis", "tidak-puas"].includes(kind)) {
    assert(text.includes("Undang-Undang Nomor 20 Tahun 2023") && text.includes("hari kerja ke-15"));
    assert(text.includes("800/204/UJI") && text.includes("upaya administratif"));
  }
  if (write) writeFileSync(`${output}/${kind}.docx`, bytes);
}
db.close();
console.log("PASS perkara Hukdis: akses terpisah, PNS aktif, register unik, revisi, dua panggilan, keputusan/upaya administratif, dan sembilan unduhan dari delapan format berkop DKPP.");
