import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const database = new Database(path.join(process.cwd(), "data", "admin.db"));
const storageDirectory = path.resolve(process.cwd(), "data", "official-statement-documents");
const outputDirectory = process.env.SMOKE_OFFICIAL_STATEMENT_OUTPUT_DIR
  ? path.resolve(process.env.SMOKE_OFFICIAL_STATEMENT_OUTPUT_DIR)
  : null;
const userId = `official-statement-smoke-${randomUUID()}`;
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const now = new Date();
const expiresAt = new Date(now.getTime() + 120_000);
const employee = database.prepare(
  `SELECT nip, name, rank, position FROM employees
   WHERE asn_type = 'PNS' AND status = 'Aktif' ORDER BY name COLLATE NOCASE LIMIT 1`,
).get();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function decodeXml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function visibleText(buffer) {
  const zip = new PizZip(buffer);
  const xml = zip.file("word/document.xml")?.asText() ?? "";
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1])).join("");
}

function assertPreservedParts(templateBuffer, generatedBuffer) {
  const templateZip = new PizZip(templateBuffer);
  const generatedZip = new PizZip(generatedBuffer);
  for (const name of Object.keys(templateZip.files)) {
    if (name === "word/document.xml" || templateZip.files[name].dir) continue;
    const expected = templateZip.file(name)?.asNodeBuffer();
    const actual = generatedZip.file(name)?.asNodeBuffer();
    assert(expected && actual && expected.equals(actual), `Bagian template berubah di luar document.xml: ${name}`);
  }
}

async function generate(payload, authenticated = true) {
  return fetch(`${baseUrl}/api/surat-hukdis-hukda/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authenticated ? { Cookie: `admin_session=${token}` } : {}) },
    body: JSON.stringify(payload),
  });
}

assert(employee, "Tidak ada PNS aktif untuk smoke test.");
const basePayload = { nip: employee.nip, nomorSurat: "800.1.11.1/123/DKPP", tanggalSurat: "2026-09-16" };

try {
  database.prepare(
    `INSERT INTO users (id, name, username, email, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(userId, "Official Statement Smoke Test", userId, `${userId}@example.test`, "not-used", now.toISOString(), now.toISOString());
  database.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(tokenHash, userId, expiresAt.toISOString(), now.toISOString());

  const unauthorized = await generate({ ...basePayload, documentType: "hukdis" }, false);
  assert(unauthorized.status === 401, "Generator tanpa sesi tidak ditolak.");
  const invalid = await generate({ ...basePayload, documentType: "hukdis", nip: "123" });
  assert(invalid.status === 422, "NIP tidak valid tidak ditolak.");

  for (const documentType of ["hukdis", "hukda"]) {
    const response = await generate({ ...basePayload, documentType });
    const generated = Buffer.from(await response.arrayBuffer());
    assert(response.status === 200, `Pembuatan ${documentType.toUpperCase()} gagal (${response.status}).`);
    assert(response.headers.get("content-type")?.includes("officedocument.wordprocessingml.document"), "Content-Type DOCX tidak tepat.");
    if (outputDirectory) {
      mkdirSync(outputDirectory, { recursive: true });
      writeFileSync(path.join(outputDirectory, `sample-${documentType}.docx`), generated);
    }

    const text = visibleText(generated);
    assert(text.includes("16 September 2026"), "Tanggal surat tidak masuk ke dokumen.");
    assert(text.includes(basePayload.nomorSurat), "Nomor surat tidak masuk ke dokumen.");
    assert(text.includes(employee.name), "Nama pegawai tidak masuk ke dokumen.");
    assert(text.includes(employee.rank), "Pangkat/golongan tidak masuk ke dokumen.");
    assert(text.includes(employee.position), "Jabatan tidak masuk ke dokumen.");
    assert(text.includes("${ttd_pengirim}"), "Penanda TTE berubah atau hilang.");
    for (const tag of ["<no_surat>", "<nama_pegawai>", "<nip_pegawai>", "<pangkat_gol_pegawai>", "<jabatan_pegawai>", "<tgl_surat>"]) {
      assert(!text.includes(tag), `Tag ${tag} belum diganti.`);
    }

    const template = readFileSync(path.join(process.cwd(), "src", "templates", `template-${documentType}.docx`));
    assertPreservedParts(template, generated);

    const row = database.prepare(
      "SELECT id, storage_name, file_name, file_size FROM official_statement_documents WHERE user_id = ? AND document_type = ?",
    ).get(userId, documentType);
    assert(row, `Metadata ${documentType.toUpperCase()} tidak tersimpan.`);
    assert(row.file_name === `Surat-${documentType.toUpperCase()}-${employee.nip}-2026-09-16.docx`, "Nama file arsip tidak tepat.");
    assert(row.file_size === generated.length, "Ukuran file arsip tidak tepat.");
    const filePath = path.resolve(storageDirectory, row.storage_name);
    assert(path.dirname(filePath) === storageDirectory && existsSync(filePath), "File fisik tidak tersimpan dengan aman.");
    assert(readFileSync(filePath).equals(generated), "Isi file arsip berbeda dari respons generator.");

    const download = await fetch(`${baseUrl}/api/surat-hukdis-hukda/${row.id}/download`, { headers: { Cookie: `admin_session=${token}` } });
    assert(download.status === 200, "Unduh ulang dokumen gagal.");
    assert(Buffer.from(await download.arrayBuffer()).equals(generated), "Isi unduhan ulang berbeda.");

    const unauthorizedDelete = await fetch(`${baseUrl}/api/surat-hukdis-hukda/${row.id}`, { method: "DELETE" });
    assert(unauthorizedDelete.status === 401, "Hapus tanpa sesi tidak ditolak.");
    const deleted = await fetch(`${baseUrl}/api/surat-hukdis-hukda/${row.id}`, { method: "DELETE", headers: { Cookie: `admin_session=${token}` } });
    assert(deleted.status === 200, "Hapus dokumen gagal.");
    assert(!database.prepare("SELECT 1 FROM official_statement_documents WHERE id = ?").get(row.id), "Metadata masih ada setelah dihapus.");
    assert(!existsSync(filePath), "File fisik masih ada setelah dihapus.");
  }

  console.log("Smoke test berhasil: HUKDIS dan HUKDA, enam tag, TTE, preservasi template, arsip, unduh ulang, dan hapus tervalidasi.");
} finally {
  const files = database.prepare("SELECT storage_name FROM official_statement_documents WHERE user_id = ?").all(userId);
  database.prepare("DELETE FROM official_statement_documents WHERE user_id = ?").run(userId);
  database.prepare("DELETE FROM users WHERE id = ?").run(userId);
  database.close();
  for (const { storage_name: storageName } of files) {
    if (!/^[0-9a-f-]{36}\.docx$/i.test(storageName)) continue;
    const filePath = path.resolve(storageDirectory, storageName);
    if (path.dirname(filePath) === storageDirectory) rmSync(filePath, { force: true });
  }
}
