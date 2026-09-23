import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const database = new Database(path.join(process.cwd(), "data", "admin.db"));
const storageDirectory = path.resolve(process.cwd(), "data", "wfh-documents");
const outputPath = process.env.SMOKE_WFH_OUTPUT ? path.resolve(process.env.SMOKE_WFH_OUTPUT) : null;
const userId = `wfh-smoke-${randomUUID()}`;
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const now = new Date();
const expiresAt = new Date(now.getTime() + 120_000);
const validPayload = {
  nomorSurat: "800.1.11.1/3000/Sekre",
  bulanWfh: "September",
  tanggalSurat: "2026-09-15",
};

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

async function generate(payload, authenticated = true) {
  return fetch(`${baseUrl}/api/wfh/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authenticated ? { Cookie: `admin_session=${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
}

try {
  database.prepare(
    `INSERT INTO users (id, name, username, email, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(userId, "WFH Smoke Test", userId, `${userId}@example.test`, "not-used", now.toISOString(), now.toISOString());
  database.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(tokenHash, userId, expiresAt.toISOString(), now.toISOString());

  const unauthorizedResponse = await generate(validPayload, false);
  assert(unauthorizedResponse.status === 401, "Generator WFH tanpa sesi tidak ditolak.");

  const mismatchedMonthResponse = await generate({ ...validPayload, bulanWfh: "Agustus" });
  assert(mismatchedMonthResponse.status === 422, "Bulan WFH yang tidak cocok dengan tanggal surat tidak ditolak.");

  const response = await generate(validPayload);
  const generated = Buffer.from(await response.arrayBuffer());
  assert(response.status === 200, `Pembuatan surat tugas WFH gagal (${response.status}).`);
  assert(response.headers.get("content-type")?.includes("officedocument.wordprocessingml.document"), "Content-Type DOCX tidak tepat.");
  if (outputPath) writeFileSync(outputPath, generated);

  const zip = new PizZip(generated);
  const documentXml = zip.file("word/document.xml")?.asText() ?? "";
  const documentText = [...documentXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("");
  assert(documentText.includes(validPayload.nomorSurat), "Nomor surat tidak masuk ke dokumen.");
  assert(documentText.includes(validPayload.bulanWfh), "Bulan WFH tidak masuk ke dokumen.");
  assert(documentText.includes("15 September 2026"), "Tanggal Indonesia tidak masuk ke dokumen.");
  assert(documentText.includes("${ttd_pengirim}"), "Penanda TTE berubah atau hilang.");
  assert(!documentText.includes("<800.1.11.1/2677/Sekre>"), "Tag nomor surat belum diganti.");
  assert(!documentText.includes("<Agustus>"), "Tag bulan belum diganti.");
  assert(!documentText.includes("<04 Agustus 2026>"), "Tag tanggal belum diganti.");

  const row = database.prepare(
    "SELECT id, storage_name, file_name, file_size FROM wfh_documents WHERE user_id = ?",
  ).get(userId);
  assert(row, "Metadata dokumen WFH tidak tersimpan.");
  assert(row.file_name === "Surat-Tugas-WFH-2026-09-15.docx", "Nama file arsip tidak tepat.");
  assert(row.file_size === generated.length, "Ukuran file arsip tidak tepat.");

  const filePath = path.resolve(storageDirectory, row.storage_name);
  assert(path.dirname(filePath) === storageDirectory, "Lokasi file arsip keluar dari direktori WFH.");
  assert(existsSync(filePath), "File fisik dokumen WFH tidak tersimpan.");
  assert(readFileSync(filePath).equals(generated), "Isi file arsip berbeda dari respons generator.");

  const downloadResponse = await fetch(`${baseUrl}/api/wfh/${row.id}/download`, {
    headers: { Cookie: `admin_session=${token}` },
  });
  const downloaded = Buffer.from(await downloadResponse.arrayBuffer());
  assert(downloadResponse.status === 200, "Unduh ulang dokumen WFH gagal.");
  assert(downloaded.equals(generated), "Isi unduhan ulang berbeda dari dokumen yang dibuat.");

  const unauthorizedDeleteResponse = await fetch(`${baseUrl}/api/wfh/${row.id}`, { method: "DELETE" });
  assert(unauthorizedDeleteResponse.status === 401, "Hapus dokumen WFH tanpa sesi tidak ditolak.");

  const deleteResponse = await fetch(`${baseUrl}/api/wfh/${row.id}`, {
    method: "DELETE",
    headers: { Cookie: `admin_session=${token}` },
  });
  assert(deleteResponse.status === 200, `Hapus dokumen WFH gagal (${deleteResponse.status}).`);
  assert(!database.prepare("SELECT 1 FROM wfh_documents WHERE id = ?").get(row.id), "Metadata WFH masih tersimpan setelah dihapus.");
  assert(!existsSync(filePath), "File fisik WFH masih tersimpan setelah dihapus.");

  const deletedDownloadResponse = await fetch(`${baseUrl}/api/wfh/${row.id}/download`, {
    headers: { Cookie: `admin_session=${token}` },
  });
  assert(deletedDownloadResponse.status === 404, "Dokumen WFH yang dihapus masih dapat diunduh.");

  console.log("Smoke test berhasil: validasi, tag DOCX, penanda TTE, arsip, autentikasi, unduh ulang, dan hapus WFH tervalidasi.");
} finally {
  const files = database.prepare("SELECT storage_name FROM wfh_documents WHERE user_id = ?").all(userId);
  database.prepare("DELETE FROM wfh_documents WHERE user_id = ?").run(userId);
  database.prepare("DELETE FROM users WHERE id = ?").run(userId);
  database.close();
  for (const { storage_name: storageName } of files) {
    if (!/^[0-9a-f-]{36}\.docx$/i.test(storageName)) continue;
    const filePath = path.resolve(storageDirectory, storageName);
    if (path.dirname(filePath) === storageDirectory) rmSync(filePath, { force: true });
  }
}
