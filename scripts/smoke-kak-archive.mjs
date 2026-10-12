import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import Database from "better-sqlite3";
import ts from "typescript";

const require = createRequire(import.meta.url), cache = new Map();
const db = new Database(":memory:");
cache.set(path.resolve("src/lib/database.ts"), { exports: { database: { prepare: sql => {
  const statement = db.prepare(sql);
  return { get: async (...values) => statement.get(...values), all: async (...values) => statement.all(...values) };
} } } });
function load(file) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); cache.set(filename, mod); mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = specifier => specifier === "server-only" ? {} : specifier.startsWith("@/") ? load(`src/${specifier.slice(2)}.ts`) : require(specifier);
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const { getKakHistory } = load("src/lib/kak.ts");
const { parseKakArchiveQuery, kakArchiveUrl } = load("src/lib/kak-archive.ts");
db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY, name TEXT);
CREATE TABLE kak_documents(id TEXT PRIMARY KEY,user_id TEXT,tahun_anggaran INTEGER,sub_kegiatan TEXT,kode_sub_kegiatan TEXT,pagu_anggaran TEXT,source_name TEXT,file_name TEXT,draft_json TEXT,created_at TEXT);
INSERT INTO users VALUES ('admin', 'Admin Uji');`);
const insert = db.prepare("INSERT INTO kak_documents VALUES (?, 'admin', ?, ?, ?, '100000.00', ?, ?, ?, ?)");
for (let i = 0; i < 137; i++) {
  const po = i % 3 === 0 ? { poDocument: { storageName: "12345678-1234-1234-1234-123456789abc.docx", fileName: "PO.docx", fileSize: 25, templateSha256: "a".repeat(64) } } : {};
  insert.run(`record-${String(i).padStart(3, "0")}`, i % 2 ? 2027 : 2028, i === 0 ? "Arsip lama 100% _" : `Kegiatan ${i}`, `01.2.06.${String(i).padStart(4, "0")}`, `RKA-${i}.pdf`, `KAK-${i}.docx`, JSON.stringify(po), i === 0 ? "2024-01-01T00:00:00.000Z" : "2026-10-12T02:00:00.000Z");
}
for (const [index, timestamp] of ["2026-10-11T16:59:59.999Z", "2026-10-11T17:00:00.000Z", "2026-10-12T16:59:59.999Z", "2026-10-12T17:00:00.000Z"].entries()) {
  insert.run(`boundary-${index}`, 2027, "Batas tanggal", "DATE", "date.pdf", "date.docx", "{}", timestamp);
}
try {
  const initial = await getKakHistory(parseKakArchiveQuery({}));
  assert.equal(initial.total, 141); assert.equal(initial.items.length, 10); assert.equal(initial.totalPages, 15);
  assert.deepEqual(initial.years, [2028, 2027]);
  const seen = new Set();
  for (let page = 1; page <= initial.totalPages; page++) {
    const result = await getKakHistory(parseKakArchiveQuery({ halaman: String(page) }));
    for (const item of result.items) { assert(!seen.has(item.id), "Duplicate row across pages"); seen.add(item.id); }
  }
  assert.equal(seen.size, 141); assert(seen.has("record-000"), "Old records outside the previous 100-row limit must remain reachable");
  const old = await getKakHistory(parseKakArchiveQuery({ q: "100% _" }));
  assert.equal(old.total, 1); assert.equal(old.items[0].id, "record-000"); assert.equal(old.items[0].poFileName, "PO.docx");
  for (const q of ["%", "_"]) assert.equal((await getKakHistory(parseKakArchiveQuery({ q }))).total, 1, "Search wildcard characters must be literal");
  assert.equal((await getKakHistory(parseKakArchiveQuery({ q: "x' OR 1=1 --" }))).total, 0);
  assert.equal((await getKakHistory(parseKakArchiveQuery({ q: "rka-130.pdf" }))).total, 1);
  assert.equal((await getKakHistory(parseKakArchiveQuery({ q: "01.2.06.0130" }))).total, 1);
  assert.equal((await getKakHistory(parseKakArchiveQuery({ q: "admin uji" }))).total, 141);
  const year = await getKakHistory(parseKakArchiveQuery({ tahun: "2027", perHalaman: "50" }));
  assert.equal(year.items.length, 50); assert.equal(year.total, 72); assert(year.items.every(item => item.tahunAnggaran === 2027));
  const dates = await getKakHistory(parseKakArchiveQuery({ q: "Batas tanggal", dari: "2026-10-12", sampai: "2026-10-12" }));
  assert.deepEqual(dates.items.map(item => item.id), ["boundary-2", "boundary-1"], "Date range must include the whole day in Asia/Jakarta");
  const beyond = await getKakHistory(parseKakArchiveQuery({ halaman: "99999", perHalaman: "25" }));
  assert.equal(beyond.query.page, 6); assert.equal(beyond.items.length, 16);
  const empty = await getKakHistory(parseKakArchiveQuery({ q: "Tidak ditemukan", halaman: "88" }));
  assert.equal(empty.query.page, 1); assert.equal(empty.totalPages, 1); assert.equal(empty.total, 0);
  assert.deepEqual(parseKakArchiveQuery({ halaman: "-1", perHalaman: "500", tahun: "bad", dari: "2026-02-30", q: ["a", "b"] }), parseKakArchiveQuery({}));
  const query = parseKakArchiveQuery({ q: "100% & cetakan", tahun: "2027", dari: "2026-10-01", sampai: "2026-10-12", halaman: "3", perHalaman: "25" });
  assert.deepEqual(parseKakArchiveQuery(Object.fromEntries(new URL(kakArchiveUrl(query), "https://example.test").searchParams)), query);
  console.log("PASS archive: 141 records across pages, old records, literal search, parameterized queries, year/date combinations, Jakarta day boundaries, stable ordering, empty results and URL round-trip");
} finally { db.close(); }
