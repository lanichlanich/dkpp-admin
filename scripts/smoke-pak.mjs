import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import PizZip from "pizzip";
import ts from "typescript";

const root = process.cwd();
const transpile = (name) => ts.transpileModule(readFileSync(path.join(root, "src/lib", name), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const pak = await import(`data:text/javascript;base64,${Buffer.from(transpile("pak.ts")).toString("base64")}`);
const { calculatePak, convertCredit, emptyPakComponents, pakLevels, pakPredicates } = pak;
for (const [level, { coefficient }] of Object.entries(pakLevels)) {
  for (const [predicate, percent] of Object.entries(pakPredicates)) assert.equal(convertCredit({ year: 2025, startMonth: 1, endMonth: 12, level, predicate }), Math.round(coefficient * percent * 10) / 1000);
}
assert.equal(convertCredit({ year: 2024, startMonth: 8, endMonth: 12, level: "Ahli Muda", predicate: "Baik" }), 10.417);
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const db = new Database(path.join(root, "data/admin.db"));
db.pragma("foreign_keys = ON");
const storage = path.resolve(root, "data/pak-documents");
const qa = path.join(root, ".tmp/pak/generated");
mkdirSync(qa, { recursive: true });
const userId = `pak-smoke-${randomUUID()}`;
const token = randomBytes(32).toString("base64url");
const now = new Date().toISOString();
const cookie = { Cookie: `admin_session=${token}` };
const beforeEmployees = db.prepare("SELECT * FROM employees ORDER BY nip").all();
const selected = [
  db.prepare("SELECT * FROM employees WHERE asn_type='PNS' AND status='Aktif' AND position_type='JF' ORDER BY nip LIMIT 1").get(),
  db.prepare("SELECT * FROM employees WHERE nip='196808282007011017'").get(),
  db.prepare("SELECT * FROM employees WHERE asn_type='PNS' AND status='Pensiun' ORDER BY nip LIMIT 1").get(),
];
assert(selected.every(Boolean), "Missing active/transferred/retired fixture employees");
const input = {
  nip: selected[1].nip, nomor: "1393/KEP/6115/SK/PAK/2026", tanggal: "2026-01-05", tempatPenetapan: "Indramayu", instansi: "Pemerintah Kab. Indramayu",
  kartuAsn: "A200800043006", tempatLahir: "INDRAMAYU", tanggalLahir: "1968-08-28", jenisKelamin: "Pria",
  pangkat: "Penata Muda Tingkat I", golongan: "III/b", tmtPangkat: "2018-04-01", jabatan: "Penyuluh Pertanian Ahli Muda", tmtJabatan: "2024-08-08", unitKerja: "DINAS KETAHANAN PANGAN DAN PERTANIAN",
  penilaiNama: "Drs SUGENG HERYANTO, M.Si", penilaiNip: "196609231987091001",
  period: { year: 2025, startMonth: 1, endMonth: 12, level: "Ahli Muda", predicate: "Baik" },
  history: [{ kind: "integrasi", year: 2022, credit: 114.336 }, { kind: "konversi", year: 2024, startMonth: 8, endMonth: 12, level: "Ahli Muda", predicate: "Baik" }],
  components: emptyPakComponents(), rankMinimum: 100, levelMinimum: 200,
};
assert.deepEqual(calculatePak(input), { oldConversion: 124.753, newConversion: 25, conversionTotal: 149.753, oldTotal: 124.753, newTotal: 25, total: 149.753, rankDifference: 49.753, levelDifference: -50.247 });
const post = (body, auth = true) => fetch(`${baseUrl}/api/pak/generate`, { method: "POST", headers: { "Content-Type": "application/json", ...(auth ? cookie : {}) }, body: JSON.stringify(body) });
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
function textOf(buffer) { return [...new PizZip(buffer).file("word/document.xml").asText().matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => decode(m[1])).join(""); }
try {
  db.prepare("INSERT INTO users (id,name,username,email,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(userId, "PAK Smoke Test", userId, `${userId}@example.test`, "not-used", now, now);
  db.prepare("INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)").run(createHash("sha256").update(token).digest("hex"), userId, new Date(Date.now() + 900000).toISOString(), now);
  assert.equal((await post(input, false)).status, 401);
  const malformed = await fetch(`${baseUrl}/api/pak/generate`, { method: "POST", headers: { ...cookie, "Content-Type": "application/json" }, body: "{" });
  assert.equal(malformed.status, 400);
  const pppk = db.prepare("SELECT nip FROM employees WHERE asn_type='PPPK' LIMIT 1").get();
  for (const changes of [
    { nip: "000000000000000000" }, { nip: pppk.nip }, { nomor: "" }, { tanggal: "2026-02-30" }, { tanggal: "2025-12-01" },
    { penilaiNip: "123" }, { kartuAsn: "" }, { jabatan: "Kepala Subbagian" }, { rankMinimum: -1 },
    { tmtJabatan: "2025-08-08" }, { period: { ...input.period, startMonth: 12, endMonth: 1 } },
    { history: [...input.history, input.history[1]] }, { history: [...input.history, input.history[0]] },
    { history: [{ ...input.history[1], year: 2025 }] }, { history: [{ ...input.history[0], credit: 1.1234 }] },
  ]) assert.equal((await post({ ...input, ...changes })).status, 422, `Invalid input accepted: ${JSON.stringify(changes)}`);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM pak_documents WHERE user_id=?").get(userId).n, 0);
  const template = new PizZip(readFileSync("src/templates/template-pak.docx"));
  for (const employee of selected) {
    const payload = { ...input, nip: employee.nip };
    const response = await post(payload);
    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200, buffer.toString());
    const content = textOf(buffer);
    for (const needle of [employee.name, employee.nip, "149,753", "124,753", "+49,753", "-50,247", "10,417", "5 Januari 2026", "III/b"]) assert(content.includes(needle), `Missing ${needle}`);
    assert(!/[{}]/.test(content), "Unresolved template tags");
    if (employee.nip !== selected[1].nip) assert(!content.includes("SUJANA"), "Source name leaked");
    const output = new PizZip(buffer);
    for (const name of Object.keys(template.files).filter((n) => n !== "word/document.xml" && !template.files[n].dir)) assert(template.file(name).asNodeBuffer().equals(output.file(name).asNodeBuffer()), `Preserved part changed: ${name}`);
    const id = response.headers.get("x-document-id");
    const row = db.prepare("SELECT * FROM pak_documents WHERE id=?").get(id);
    assert.equal(row.employee_status, employee.status); assert.equal(row.total, 149.753);
    assert.equal(JSON.parse(row.input_json).golongan, "III/b");
    assert(readFileSync(path.join(storage, row.storage_name)).equals(buffer));
    assert.equal((await fetch(`${baseUrl}/api/pak/${id}/download`)).status, 401);
    const download = await fetch(`${baseUrl}/api/pak/${id}/download`, { headers: cookie });
    assert.equal(download.status, 200); assert(Buffer.from(await download.arrayBuffer()).equals(buffer));
    writeFileSync(path.join(qa, `sample-${employee.status.toLowerCase()}.docx`), buffer);
    const page = await fetch(`${baseUrl}/dashboard/pak`, { headers: cookie });
    const pageText = await page.text();
    assert.equal(page.status, 200); assert(pageText.includes("Pembuatan PAK") && pageText.includes(employee.name) && pageText.includes(input.nomor));
  }
  const partial = { ...input, period: { ...input.period, startMonth: 8 }, components: { ...input.components, pendidikan: { old: 2.125, new: 3.5, note: "Uji pendidikan" } }, levelMinimum: null };
  const partialResponse = await post(partial);
  const partialBuffer = Buffer.from(await partialResponse.arrayBuffer());
  assert.equal(partialResponse.status, 200);
  assert(textOf(partialBuffer).includes("5/12 x kolom 2 x kolom 3"));
  assert(textOf(partialBuffer).includes("140,795"));
  writeFileSync(path.join(qa, "sample-periodik.docx"), partialBuffer);
  assert.equal((await fetch(`${baseUrl}/api/pak/unknown/download`, { headers: cookie })).status, 404);
  assert.deepEqual(db.prepare("SELECT * FROM employees ORDER BY nip").all(), beforeEmployees, "Master employee data changed");
  console.log("PAK smoke passed: all coefficients/predicates, sample totals, partial period, extra components, 15 invalid cases, 3 employee statuses, preserved template parts, archived snapshots, authenticated byte-identical downloads, unchanged employee master.");
} finally {
  const rows = db.prepare("SELECT storage_name FROM pak_documents WHERE user_id=?").all(userId);
  db.prepare("DELETE FROM pak_documents WHERE user_id=?").run(userId);
  db.prepare("DELETE FROM users WHERE id=?").run(userId);
  for (const { storage_name: name } of rows) {
    const file = path.resolve(storage, name);
    if (/^[0-9a-f-]{36}\.docx$/i.test(name) && path.dirname(file) === storage && existsSync(file)) rmSync(file);
  }
  db.close();
}
