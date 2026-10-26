import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import Module, { createRequire } from "node:module";
import path from "node:path";
import Database from "better-sqlite3";
import PizZip from "pizzip";
import ts from "typescript";

const require = createRequire(import.meta.url);
const db = new Database(":memory:");
db.pragma("foreign_keys = ON");
db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT)");
db.exec("INSERT INTO users VALUES ('test-user', 'Penguji')");
db.exec("CREATE TABLE employees (nip TEXT PRIMARY KEY, name TEXT, rank TEXT, position TEXT, unit TEXT, asn_type TEXT, status TEXT)");
const schema = readFileSync("src/lib/db.ts", "utf8").match(/CREATE TABLE IF NOT EXISTS surat_perbantuan_documents \([\s\S]*?ON surat_perbantuan_documents\(user_id\);/)[0];
db.exec(schema);
db.exec(schema);
const employee = { nip: "199001012024211001", name: "PEGAWAI & UJI, S.P.", rank: "IX / Penata Muda", position: "Pengadministrasi Perkantoran", unit: "Sekretariat", asnType: "PPPK" };
const insertEmployee = db.prepare("INSERT INTO employees VALUES (?, ?, ?, ?, ?, ?, ?)");
insertEmployee.run(employee.nip, employee.name, employee.rank, employee.position, employee.unit, employee.asnType, "Aktif");
insertEmployee.run("199001012024211002", "Pegawai nonaktif", "III/a / Penata Muda", "Pelaksana", "Unit", "PNS", "Pensiun");
let user = { id: "test-user", isAdministrator: false, menuPermissions: ["surat-perbantuan"] };
let failInsert = false;
let remote = false;
let unavailable = false;
const uploaded = new Map();
const localFiles = new Set();
const adapter = { prepare(sql) {
  const statement = db.prepare(sql);
  return {
    all: async (...values) => statement.all(...values),
    get: async (...values) => statement.get(...values),
    run: async (...values) => {
      if (failInsert && /INSERT INTO surat_perbantuan_documents/.test(sql)) throw new Error("Expected database failure");
      return statement.run(...values);
    },
  };
} };
const mocks = {
  "@/lib/database": { database: adapter },
  "@/lib/session": { getCurrentUser: async () => user, requireUser: async () => { if (!user) throw new Error("Unauthorized"); return user; } },
  "@/lib/storage": {
    isStorageConfigured: () => remote,
    uploadStorageObject: async (name, bytes) => {
      if (remote) uploaded.set(name, bytes);
      else localFiles.add(path.resolve("data/surat-perbantuan-documents", name));
    },
    deleteStorageObject: async (name) => uploaded.delete(name),
    downloadStorageObject: async (name, fallback) => {
      if (unavailable) throw new Error("Expected missing file");
      return remote ? uploaded.get(name) : readFile(fallback);
    },
  },
};
const cache = new Map();
function load(file) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename).exports;
  if (filename.endsWith(".json")) return JSON.parse(readFileSync(filename, "utf8"));
  const mod = new Module(filename);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (name) => {
    if (name === "server-only") return {};
    if (mocks[name]) return mocks[name];
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}${path.extname(name) ? "" : ".ts"}`);
    return require(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}

const values = { employeeNip: employee.nip, nomorSurat: "1234.a", tanggalSurat: "2026-10-26", jabatanPerbantuan: "Pengelola Data & Informasi", unitKerjaPerbantuan: "Bidang Tanaman Pangan" };
const { suratPerbantuanSchema, perbantuanRank } = load("src/lib/surat-perbantuan-validation.ts");
const { generateSuratPerbantuanDocument } = load("src/lib/surat-perbantuan-document.ts");
const archive = load("src/lib/surat-perbantuan.ts");
const { POST } = load("src/app/api/surat-perbantuan/generate/route.ts");
const { GET } = load("src/app/api/surat-perbantuan/[id]/download/route.ts");
const post = (input = values) => POST(new Request("http://localhost/api/surat-perbantuan/generate", { method: "POST", body: JSON.stringify(input) }));
const get = (id) => GET(new Request(`http://localhost/api/surat-perbantuan/${id}/download`), { params: Promise.resolve({ id }) });
const decode = (text) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const textPattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const visible = (xml) => [...xml.matchAll(textPattern)].map((m) => decode(m[1])).join("");
const source = new PizZip(readFileSync("src/templates/template-surat-perbantuan.docx"));
const sourceXml = source.file("word/document.xml").asText();
const sourceWithoutTrailingSpacers = sourceXml.replace(/<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g,
  (paragraph, offset) => offset > sourceXml.lastIndexOf("</w:t>") ? "" : paragraph);
const fixtures = [];

try {
  for (const change of [
    { employeeNip: "123" }, { employeeNip: 199001012024211001 }, { nomorSurat: "" }, { nomorSurat: "800.1.11.1/123/Sekret" },
    { nomorSurat: "<tag>" }, { nomorSurat: "123\n456" }, { tanggalSurat: "" }, { tanggalSurat: "2026-02-29" },
    { tanggalSurat: "2026-04-31" }, { jabatanPerbantuan: " " }, { jabatanPerbantuan: "<jabatan>" },
    { unitKerjaPerbantuan: "baris\nbaru" }, { unitKerjaPerbantuan: "x".repeat(241) },
  ]) {
    assert.equal(suratPerbantuanSchema.safeParse({ ...values, ...change }).success, false);
    assert.equal((await post({ ...values, ...change })).status, 422);
  }
  assert(suratPerbantuanSchema.safeParse({ ...values, tanggalSurat: "2028-02-29" }).success);
  assert.deepEqual(perbantuanRank("III/a / Penata Muda"), { pangkat: "Penata Muda", golongan: "III/a" });
  assert.deepEqual(perbantuanRank("IX / Penata Muda"), { pangkat: "Penata Muda", golongan: "IX" });
  assert.deepEqual(perbantuanRank("null / null"), { pangkat: "-", golongan: "-" });
  assert.equal((await post({ ...values, employeeNip: "199001012024211002" })).status, 422);
  assert.equal((await post({ ...values, employeeNip: "000000000000000000" })).status, 422);
  assert.equal((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status, 400);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM surat_perbantuan_documents").get().n, 0);
  console.log("PASS date, letter number, assignment validation; inactive/missing employees; rank/grade mapping");

  for (const sample of [employee, { ...employee, rank: "III/a / Penata Muda", asnType: "PNS" }, { ...employee, rank: "null / null", asnType: "PPPK PW" }]) {
    const bytes = await generateSuratPerbantuanDocument({ employee: sample, values });
    const zip = new PizZip(bytes);
    const xml = zip.file("word/document.xml").asText();
    const text = visible(xml);
    assert(!/<[^<>]+>/.test(text));
    for (const field of [employee.name, employee.nip, values.jabatanPerbantuan, values.unitKerjaPerbantuan, "26 Oktober 2026", "1234.a"]) assert(text.includes(field), field);
    assert.equal(text.split(employee.position).length - 1, 2, "Both position tags must be replaced");
    assert.equal(text.split(employee.unit).length - 1, 2, "Both unit tag spellings must be replaced");
    assert(text.includes(`${perbantuanRank(sample.rank).pangkat} / ${perbantuanRank(sample.rank).golongan}`));
    const layout = (value) => value.replace(/<w:keepNext\/>/g, "").replace(textPattern, "TEXT");
    assert.equal(layout(xml), layout(sourceWithoutTrailingSpacers), "Formatting changed outside trailing spacers and tembusan pagination");
    assert.equal((xml.match(/<w:keepNext\/>/g) ?? []).length, (sourceWithoutTrailingSpacers.match(/<w:keepNext\/>/g) ?? []).length + 3);
    assert.deepEqual(Object.keys(zip.files), Object.keys(source.files));
    for (const [name, part] of Object.entries(source.files)) if (!part.dir && name !== "word/document.xml") assert(part.asNodeBuffer().equals(zip.file(name).asNodeBuffer()), `Changed template part: ${name}`);
    fixtures.push({ name: `surat-perbantuan-${sample.asnType.replace(/ /g, "-")}.docx`, bytes });
  }
  // Exercise several split tags in one paragraph with longer identity and destination values.
  fixtures.push({ name: "surat-perbantuan-long.docx", bytes: await generateSuratPerbantuanDocument({
    employee: { ...employee, name: "CONTOH PEGAWAI DENGAN NAMA PANJANG, S.P., M.Si.", position: "Pengelola Layanan Operasional", unit: "Unit Pelaksana Teknis Dinas Balai Penyuluhan Pertanian Kecamatan Indramayu" },
    values: { ...values, jabatanPerbantuan: "Pengadministrasi Perkantoran", unitKerjaPerbantuan: "Subbagian Umum dan Kepegawaian Dinas Ketahanan Pangan dan Pertanian Kabupaten Indramayu" },
  }) });
  console.log("PASS PNS/PPPK/PPPK PW DOCX; split/repeated tags; XML escaping; all other ZIP parts and formatting preserved");

  const savedUser = user;
  user = null;
  assert.equal((await post()).status, 401);
  assert.equal((await get("missing")).status, 401);
  user = { ...savedUser, menuPermissions: [] };
  assert.equal((await post()).status, 403);
  assert.equal((await get("missing")).status, 403);
  user = savedUser;
  assert.equal((await get("missing")).status, 404);
  assert.deepEqual((await archive.getEmployeesForSuratPerbantuan()).map((e) => e.nip), [employee.nip]);

  for (const useRemote of [false, true]) {
    remote = useRemote;
    const response = await post({ ...values, employee: { ...employee, name: "FORGED IDENTITY" }, employeeName: "FORGED IDENTITY" });
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(!visible(new PizZip(bytes).file("word/document.xml").asText()).includes("FORGED IDENTITY"));
    const row = db.prepare("SELECT * FROM surat_perbantuan_documents ORDER BY created_at DESC LIMIT 1").get();
    assert.equal(row.employee_name, employee.name);
    assert.equal(row.employee_rank, "Penata Muda");
    assert.equal(row.employee_grade, "IX");
    assert.equal(row.tanggal_surat, values.tanggalSurat);
    assert.equal(row.jabatan_perbantuan, values.jabatanPerbantuan);
    assert.equal(row.file_size, bytes.length);
    assert(response.headers.get("Content-Disposition").includes(row.file_name));
    const download = await get(row.id);
    assert.equal(download.status, 200);
    assert.equal(download.headers.get("Content-Length"), String(bytes.length));
    assert(Buffer.from(await download.arrayBuffer()).equals(bytes));
    assert((await archive.getSuratPerbantuanHistory()).some((item) => item.id === row.id && item.employeeName === employee.name && item.createdBy === "Penguji"));
    const errors = console.error;
    console.error = () => {};
    try {
      unavailable = true;
      assert.equal((await get(row.id)).status, 404);
      unavailable = false;
      failInsert = true;
      const before = uploaded.size;
      const filesBeforeFailure = new Set(localFiles);
      assert.equal((await post()).status, 500);
      assert.equal(uploaded.size, before, "Failed persistence must clean up remote files");
      for (const file of localFiles) if (!filesBeforeFailure.has(file)) await assert.rejects(readFile(file), { code: "ENOENT" });
      failInsert = false;
    } finally { console.error = errors; unavailable = false; failInsert = false; }
  }
  const corruptedId = db.prepare("SELECT id FROM surat_perbantuan_documents LIMIT 1").get().id;
  db.prepare("UPDATE surat_perbantuan_documents SET storage_name = '../escape.docx' WHERE id = ?").run(corruptedId);
  assert.equal((await get(corruptedId)).status, 404);
  const access = load("src/lib/access-control.ts");
  assert(access.MENU_CATALOG.some((item) => item.id === "surat-perbantuan" && item.group === "Persuratan"));
  assert(access.canAccessPath(user, "/dashboard/surat-perbantuan"));
  assert(!access.canAccessPath({ ...user, menuPermissions: [] }, "/dashboard/surat-perbantuan"));
  console.log("PASS local/remote archive, server-resolved identity, authenticated/authorized redownload, missing files, path validation and rollback cleanup");
  if (process.argv.includes("--write-fixtures")) {
    mkdirSync(".tmp/surat-perbantuan", { recursive: true });
    for (const fixture of fixtures) writeFileSync(path.join(".tmp/surat-perbantuan", fixture.name), fixture.bytes);
    console.log("Wrote visual QA fixtures to .tmp/surat-perbantuan");
  }
} finally {
  db.close();
  for (const file of localFiles) await rm(file, { force: true });
}
