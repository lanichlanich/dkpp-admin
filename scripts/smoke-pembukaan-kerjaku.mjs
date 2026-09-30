import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";

const base = process.env.SMOKE_BASE_URL || "http://localhost:3100";
const db = new Database("data/admin.db");
const id = `kerjaku-smoke-${randomUUID()}`;
const token = randomBytes(32).toString("base64url");
const headers = { "Content-Type": "application/json", Cookie: `admin_session=${token}` };
const template = new PizZip(readFileSync("src/templates/template-pembukaan-kerjaku.docx"));
const employees = db.prepare("SELECT nip, name, position FROM employees WHERE status = 'Aktif' ORDER BY name LIMIT 20").all();
function assert(ok, message) { if (!ok) throw new Error(message); }
const payload = { tanggalSurat: "2027-01-02", nomorSurat: "800.1.5/77-Sekret", bulanDibuka: "2026-12", employeeNips: employees.slice(0, 1).map(e => e.nip) };
const generate = (body, auth = true) => fetch(`${base}/api/pembukaan-kerjaku/generate`, { method: "POST", headers: auth ? headers : { "Content-Type": "application/json" }, body: JSON.stringify(body) });
try {
  assert(employees.length >= 8, "Diperlukan minimal 8 pegawai aktif untuk pengujian.");
  const now = new Date().toISOString();
  db.prepare("INSERT INTO users (id,name,username,email,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(id, "Kerjaku Smoke", id, `${id}@example.test`, "unused", now, now);
  db.prepare("INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)").run(createHash("sha256").update(token).digest("hex"), id, new Date(Date.now()+600000).toISOString(), now);
  assert((await generate(payload, false)).status === 401, "Generator tanpa sesi harus ditolak.");
  for (const employeeNips of [[], [employees[0].nip, employees[0].nip], ["not-an-employee"]]) {
    assert((await generate({ ...payload, employeeNips })).status === 422, "Pilihan pegawai tidak valid harus ditolak.");
  }
  for (const count of [1, 5, 8]) {
    const selected = employees.slice(0, count);
    const response = await generate({ ...payload, employeeNips: selected.map(e => e.nip) });
    assert(response.status === 200, `Pembuatan ${count} pegawai gagal: ${await (response.status === 200 ? Promise.resolve("") : response.text())}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const zip = new PizZip(bytes);
    const xml = zip.file("word/document.xml").asText();
    const text = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1].replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&")).join("");
    assert((xml.match(/<w:tr(?=[\s>])/g)||[]).length === count+1, "Jumlah baris lampiran salah.");
    assert(text.includes("2 Januari 2027") && text.includes("Desember 2026") && text.includes(payload.nomorSurat), "Isian surat salah.");
    assert(text.includes("${ttd_pengirim}"), "Penanda TTE hilang.");
    for (const employee of selected) assert(text.includes(employee.nip) && text.includes(employee.name), "Pegawai tidak masuk lampiran.");
    for (const part of Object.keys(template.files).filter(n => !template.files[n].dir && n !== "word/document.xml")) {
      assert(zip.file(part)?.asNodeBuffer().equals(template.file(part).asNodeBuffer()), `Bagian template berubah: ${part}`);
    }
    const row = db.prepare("SELECT id, storage_name FROM kerjaku_request_documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(id);
    assert(row, "Arsip tidak tersimpan.");
    const download = await fetch(`${base}/api/pembukaan-kerjaku/${row.id}/download`, { headers });
    assert(download.status === 200 && Buffer.from(await download.arrayBuffer()).equals(bytes), "Unduh ulang berbeda.");
    assert((await fetch(`${base}/api/pembukaan-kerjaku/${row.id}/download`)).status === 401, "Unduhan tanpa sesi tidak ditolak.");
    console.log(`PASS ${count} pegawai: generator, format paket, arsip, unduh ulang`);
  }
} finally {
  for (const row of db.prepare("SELECT storage_name FROM kerjaku_request_documents WHERE user_id = ?").all(id)) rmSync(path.join("data/kerjaku-request-documents",row.storage_name), { force: true });
  db.prepare("DELETE FROM kerjaku_request_documents WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  db.close();
}
