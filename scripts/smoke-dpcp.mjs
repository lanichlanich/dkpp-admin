import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import PizZip from "pizzip";
import ts from "typescript";

const transpile = (name) => ts.transpileModule(readFileSync(`src/lib/${name}.ts`, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const salaryData = JSON.parse(readFileSync("src/data/pns-salary-2024.json", "utf8"));
const kgbUrl = moduleUrl(transpile("kgb").replace(/import salaryData[^;]+;/, `const salaryData = ${JSON.stringify(salaryData)};`));
const calculations = await import(moduleUrl(transpile("dpcp-calculations").replace('"@/lib/kgb"', JSON.stringify(kgbUrl))));
const { dpcpSalary, dpcpRetirementDate, dpcpPensionService, parseDpcpService, dpcpParents } = calculations;
assert.deepEqual(parseDpcpService("28 Tahun 4 Bulan"), { years: 28, months: 4 });
assert.equal(parseDpcpService("28 Tahun 12 Bulan"), null);
assert.equal(parseDpcpService("-1 Tahun"), null);
assert.equal(dpcpSalary("III/a / Penata Muda", "0 Tahun 0 Bulan"), 2785700);
assert.equal(dpcpSalary("III/a", "28 Tahun 11 Bulan"), salaryData.salaries["III/a"]["28"]);
assert.equal(dpcpSalary("IV/b", "40 Tahun 0 Bulan"), salaryData.salaries["IV/b"]["32"]);
assert.equal(dpcpSalary("I/a", "40 Tahun"), salaryData.salaries["I/a"]["27"]);
assert.equal(dpcpSalary("Unknown", "20 Tahun"), null);
assert.equal(dpcpRetirementDate("196904072009011009", "58 Tahun"), "2027-05-01");
assert.equal(dpcpRetirementDate("196812312009011009", "60 Tahun"), "2029-01-01");
assert.equal(dpcpRetirementDate("196802292009011009", "65 Tahun"), "2033-03-01");
assert.equal(dpcpRetirementDate("196902302009011009", "58 Tahun"), "");
assert.equal(dpcpPensionService("2010-12-01", "2027-05-01"), "16 Tahun 5 Bulan");
assert.equal(dpcpPensionService("2010-12-02", "2027-05-01"), "16 Tahun 4 Bulan");
assert.equal(dpcpPensionService("2030-01-01", "2027-05-01"), "");
assert.equal(dpcpParents("Pegawai", "Pasangan"), "Pegawai / Pasangan");
if (process.env.DPCP_CALCULATIONS_ONLY === "1") {
  console.log("DPCP calculations passed.");
  process.exit(0);
}

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3100";
const db = new Database("data/admin.db");
db.pragma("foreign_keys = ON");
const userId = `dpcp-smoke-${randomUUID()}`;
const token = randomBytes(32).toString("base64url");
const now = new Date().toISOString();
const cookie = { Cookie: `admin_session=${token}` };
const employee = db.prepare("SELECT * FROM employees WHERE asn_type='PNS' AND status='Aktif' AND rank LIKE 'III/a%' ORDER BY nip LIMIT 1").get();
assert(employee);
const input = {
  nip: employee.nip, bup: "58 Tahun", tempatLahir: "INDRAMAYU", gaji: 1, mkg: "28 Tahun 4 Bulan", mkp: "nilai klien diabaikan",
  mksp: "", pendidikan1: "S1", tmtpns: "2009-01-01", namaPasangan: "PASANGAN UJI", tglPasangan: "1975-01-01", tglNikah: "2000-01-01",
  pasanganKe: "", namaAnak1: "ANAK UJI", tglAnak1: "2005-01-01", statusAnak1: "", orangTuaAnak1: "",
  namaAnak2: "", tglAnak2: "", statusAnak2: "AK (Anak Kandung)", orangTuaAnak2: "DEFAULT PARENT UNUSED",
  alamatPensiun: "INDRAMAYU", tglDpcp: "2026-10-01",
};
const post = (body, auth = true) => fetch(`${baseUrl}/api/dpcp/generate`, { method: "POST", headers: { "Content-Type": "application/json", ...(auth ? cookie : {}) }, body: JSON.stringify(body) });
try {
  db.prepare("INSERT INTO users(id,name,username,email,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(userId, "DPCP test", userId, `${userId}@example.test`, "unused", now, now);
  db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").run(createHash("sha256").update(token).digest("hex"), userId, new Date(Date.now() + 900000).toISOString(), now);
  assert.equal((await post(input, false)).status, 401);
  for (const change of [{ bup: "59 Tahun" }, { mkg: "28 Tahun 12 Bulan" }, { tmtpns: "2009-02-30" }, { tmtpns: "2099-01-01" }]) {
    assert.equal((await post({ ...input, ...change })).status, 422);
  }
  const response = await post(input);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, bytes.toString());
  const output = new PizZip(bytes);
  const text = [...output.file("word/document.xml").asText().matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("").replace(/&amp;/g, "&");
  const { formatRupiah } = await import(kgbUrl);
  for (const value of [formatRupiah(dpcpSalary(employee.rank, input.mkg)), dpcpPensionService(input.tmtpns, dpcpRetirementDate(input.nip, input.bup)), "1 (satu)", "AK (Anak Kandung)", `${employee.name} / PASANGAN UJI`]) assert(text.includes(value), `Missing ${value}`);
  assert(!text.includes("nilai klien diabaikan") && !text.includes("DEFAULT PARENT UNUSED"));
  assert.equal(text.split("AK (Anak Kandung)").length - 1, 1, "Unused child row must be blank");
  const template = new PizZip(readFileSync("src/templates/template-dpcp.docx"));
  for (const name of Object.keys(template.files).filter((name) => !template.files[name].dir && name !== "word/document.xml")) assert(template.file(name).asNodeBuffer().equals(output.file(name).asNodeBuffer()), `Template part changed: ${name}`);
  const row = db.prepare("SELECT * FROM dpcp_documents WHERE user_id=?").get(userId);
  assert(row);
  const download = await fetch(`${baseUrl}/api/dpcp/${row.id}/download`, { headers: cookie });
  assert.equal(download.status, 200);
  assert(bytes.equals(Buffer.from(await download.arrayBuffer())));
  mkdirSync(".tmp/dpcp-qa", { recursive: true });
  writeFileSync(".tmp/dpcp-qa/sample.docx", bytes);
  console.log("DPCP smoke passed: salary table, BUP/date boundaries, pension service, server recalculation, family defaults, blank unused rows, preserved template parts, archive and download.");
} finally {
  const rows = db.prepare("SELECT storage_name FROM dpcp_documents WHERE user_id=?").all(userId);
  db.prepare("DELETE FROM dpcp_documents WHERE user_id=?").run(userId);
  db.prepare("DELETE FROM users WHERE id=?").run(userId);
  for (const { storage_name: name } of rows) if (/^[0-9a-f-]{36}\.docx$/i.test(name)) rmSync(path.join("data/dpcp-documents", name), { force: true });
  db.close();
}
