import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";

const base = process.env.SMOKE_BASE_URL || "http://localhost:3100";
await fetch(`${base}/login`);
const db = new Database("data/admin.db");
const id = `kak-smoke-${randomUUID()}`;
const token = randomBytes(32).toString("base64url");
const headers = { Cookie: `admin_session=${token}` };
function body(file, options = { tanggalDokumen: "2026-10-08", pptkNama: "", pptkNip: "" }) { const form = new FormData(); form.set("file", file); form.set("options", JSON.stringify(options)); return form; }
const generate = (form, auth = true) => fetch(`${base}/api/kak/generate`, { method: "POST", headers: auth ? headers : {}, body: form });
try {
  const now = new Date().toISOString();
  db.prepare("INSERT INTO users (id,name,username,email,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(id, "KAK Smoke", id, `${id}@example.test`, "unused", now, now);
  db.prepare("INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)").run(createHash("sha256").update(token).digest("hex"), id, new Date(Date.now() + 600000).toISOString(), now);
  assert.equal((await generate(body(new File(["%PDF-"], "rka.pdf")), false)).status, 401);
  assert.equal((await generate(body(new File(["%PDF-"], "rka.pdf"), { tanggalDokumen: "bad" }))).status, 400);
  for (const file of [new File(["not pdf"], "rka.pdf"), new File(["%PDF-"], "rka.txt"), new File([], "rka.pdf")]) assert.equal((await generate(body(file))).status, 422);
  assert.equal((await generate(body(new File([Buffer.alloc(2097153)], "rka.pdf")))).status, 413);
  assert.equal((await fetch(`${base}/api/kak/${randomUUID()}/download`, { headers })).status, 404);
  const page = await fetch(`${base}/dashboard/pembuatan-kak`, { headers });
  assert.equal(page.status, 200); const html = await page.text(); assert(html.includes("Pembuatan KAK") && html.includes("Perencanaan"));
  console.log("PASS HTTP authentication, input validation, 2 MB cap, missing-document response and KAK page");
  const sourcePath = process.argv[2];
  if (sourcePath) {
    const source = readFileSync(sourcePath);
    const response = await generate(body(new File([source], "RKA-Cetakan-2027.pdf", { type: "application/pdf" })));
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.metadata.tahunAnggaran, 2027); assert.equal(result.metadata.paguAnggaran, "29359021.00");
    assert.equal(result.metadata.rincianAnggaran.length, 8);
    assert.equal(result.references.length, 2);
    assert(result.references.every(r => /^[0-9a-f]{64}$/.test(r.sha256) && r.locators.length));
    assert(result.warnings.some(w => w.includes("Renstra") && w.includes("berbeda")));
    assert(result.warnings.some(w => /PPTK/i.test(w)));
    const row = db.prepare("SELECT * FROM kak_documents WHERE id=? AND user_id=?").get(result.id, id);
    assert(row); assert.equal(row.source_file_size, source.length);
    const download = await fetch(`${base}/api/kak/${result.id}/download`, { headers });
    assert.equal(download.status, 200); const bytes = Buffer.from(await download.arrayBuffer());
    assert.equal(bytes.length, row.file_size);
    const zip = new PizZip(bytes); const xml = zip.file("word/document.xml").asText();
    assert(xml.includes("29.359.021,00") && xml.includes("2027") && xml.includes("RORY FIRMANSYAH"));
    assert(xml.includes("Renstra DKPP Tahun 2025-2029") && xml.includes("Rancangan Akhir Renja DKPP Tahun 2027"));
    assert(xml.includes("160 Tahun 2024"), "Dasar hukum tugas/fungsi DKPP tidak diisi.");
    const archived = JSON.parse(row.draft_json);
    assert.equal(archived.references.length, 2); assert(archived.legalBasisIds.length > 0);
    assert(!xml.includes("&lt;generate"));
    const template = new PizZip(readFileSync("src/templates/template-kak.docx"));
    for (const name of Object.keys(template.files)) if (!template.files[name].dir && name !== "word/document.xml") assert(template.files[name].asNodeBuffer().equals(zip.file(name).asNodeBuffer()), name);
    const rka = await fetch(`${base}/api/kak/${result.id}/download?source=rka`, { headers });
    assert.equal(rka.status, 200); assert(Buffer.from(await rka.arrayBuffer()).equals(source));
    assert.equal((await fetch(`${base}/api/kak/${result.id}/download`)).status, 401);
    assert.equal((await fetch(`${base}/api/kak/${result.id}/download?source=rka`)).status, 401);
    mkdirSync(".tmp/kak", { recursive: true }); writeFileSync(".tmp/kak/http-sample.docx", bytes);
    writeFileSync(".tmp/kak/http-draft.json", row.draft_json);
    console.log("PASS live Gemini example: TA 2027, correct pagu, 8 items, template slots, DOCX/RKA persistence and authenticated re-download");
  }
} finally {
  for (const row of db.prepare("SELECT storage_name,source_storage_name FROM kak_documents WHERE user_id=?").all(id)) {
    for (const name of [row.storage_name, row.source_storage_name]) rmSync(path.join("data/kak-documents", name), { force: true });
  }
  db.prepare("DELETE FROM kak_documents WHERE user_id=?").run(id);
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
  db.prepare("DELETE FROM users WHERE id=?").run(id);
  db.close();
}
