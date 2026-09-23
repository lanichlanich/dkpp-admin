import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const database = new Database(path.join(process.cwd(), "data", "admin.db"));
const storageDirectory = path.resolve(process.cwd(), "data", "surat-pengantar-documents");
const outputPath = process.env.SMOKE_SURAT_PENGANTAR_OUTPUT
  ? path.resolve(process.env.SMOKE_SURAT_PENGANTAR_OUTPUT)
  : null;
const userId = `surat-pengantar-smoke-${randomUUID()}`;
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const now = new Date();
const expiresAt = new Date(now.getTime() + 120_000);
const validPayload = {
  tanggalSurat: "2026-09-15",
  nomorSurat: "800.1.11.1/3001/Sekre",
  nomorUrut: "1",
  fileYangDikirim: "Berkas usulan kenaikan pangkat periode Oktober 2026",
  jumlah: "2",
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
  return fetch(`${baseUrl}/api/surat-pengantar/generate`, {
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
  ).run(userId, "Surat Pengantar Smoke Test", userId, `${userId}@example.test`, "not-used", now.toISOString(), now.toISOString());
  database.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(tokenHash, userId, expiresAt.toISOString(), now.toISOString());

  const unauthorizedResponse = await generate(validPayload, false);
  assert(unauthorizedResponse.status === 401, "Generator surat pengantar tanpa sesi tidak ditolak.");

  const invalidResponse = await generate({ ...validPayload, jumlah: "0" });
  assert(invalidResponse.status === 422, "Jumlah bundle nol tidak ditolak.");

  const response = await generate(validPayload);
  const generated = Buffer.from(await response.arrayBuffer());
  assert(response.status === 200, `Pembuatan surat pengantar gagal (${response.status}).`);
  assert(response.headers.get("content-type")?.includes("officedocument.wordprocessingml.document"), "Content-Type DOCX tidak tepat.");
  if (outputPath) writeFileSync(outputPath, generated);

  const zip = new PizZip(generated);
  const documentXml = zip.file("word/document.xml")?.asText() ?? "";
  const documentText = [...documentXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("");
  assert(documentText.includes("15 September 2026"), "Tanggal surat tidak masuk ke dokumen.");
  assert(documentText.includes(validPayload.nomorSurat), "Nomor surat tidak masuk ke dokumen.");
  assert(documentText.includes(validPayload.fileYangDikirim), "Deskripsi file tidak masuk ke dokumen.");
  assert(documentText.includes("2 bundle"), "Jumlah bundle tidak masuk ke dokumen.");
  assert(documentText.includes("${ttd_pengirim}"), "Penanda TTE berubah atau hilang.");
  for (const tag of ["<tanggal>", "<no surat>", "<no>", "<file yang dikirim>", "<jumlah>"]) {
    assert(!documentText.includes(tag), `Tag ${tag} belum diganti.`);
  }

  const row = database.prepare(
    "SELECT id, storage_name, file_name, file_size FROM surat_pengantar_documents WHERE user_id = ?",
  ).get(userId);
  assert(row, "Metadata surat pengantar tidak tersimpan.");
  assert(row.file_name === "Surat-Pengantar-2026-09-15.docx", "Nama file arsip tidak tepat.");
  assert(row.file_size === generated.length, "Ukuran file arsip tidak tepat.");

  const filePath = path.resolve(storageDirectory, row.storage_name);
  assert(path.dirname(filePath) === storageDirectory, "Lokasi file arsip keluar dari direktori surat pengantar.");
  assert(existsSync(filePath), "File fisik surat pengantar tidak tersimpan.");
  assert(readFileSync(filePath).equals(generated), "Isi file arsip berbeda dari respons generator.");

  const downloadResponse = await fetch(`${baseUrl}/api/surat-pengantar/${row.id}/download`, {
    headers: { Cookie: `admin_session=${token}` },
  });
  const downloaded = Buffer.from(await downloadResponse.arrayBuffer());
  assert(downloadResponse.status === 200, "Unduh ulang surat pengantar gagal.");
  assert(downloaded.equals(generated), "Isi unduhan ulang berbeda dari dokumen yang dibuat.");

  const unauthorizedDeleteResponse = await fetch(`${baseUrl}/api/surat-pengantar/${row.id}`, { method: "DELETE" });
  assert(unauthorizedDeleteResponse.status === 401, "Hapus surat pengantar tanpa sesi tidak ditolak.");

  const deleteResponse = await fetch(`${baseUrl}/api/surat-pengantar/${row.id}`, {
    method: "DELETE",
    headers: { Cookie: `admin_session=${token}` },
  });
  assert(deleteResponse.status === 200, `Hapus surat pengantar gagal (${deleteResponse.status}).`);
  assert(!database.prepare("SELECT 1 FROM surat_pengantar_documents WHERE id = ?").get(row.id), "Metadata masih tersimpan setelah dihapus.");
  assert(!existsSync(filePath), "File fisik masih tersimpan setelah dihapus.");

  const deletedDownloadResponse = await fetch(`${baseUrl}/api/surat-pengantar/${row.id}/download`, {
    headers: { Cookie: `admin_session=${token}` },
  });
  assert(deletedDownloadResponse.status === 404, "Surat pengantar yang dihapus masih dapat diunduh.");

  console.log("Smoke test berhasil: validasi, lima tag DOCX, TTE, arsip, unduh ulang, dan hapus surat pengantar tervalidasi.");
} finally {
  const files = database.prepare("SELECT storage_name FROM surat_pengantar_documents WHERE user_id = ?").all(userId);
  database.prepare("DELETE FROM surat_pengantar_documents WHERE user_id = ?").run(userId);
  database.prepare("DELETE FROM users WHERE id = ?").run(userId);
  database.close();
  for (const { storage_name: storageName } of files) {
    if (!/^[0-9a-f-]{36}\.docx$/i.test(storageName)) continue;
    const filePath = path.resolve(storageDirectory, storageName);
    if (path.dirname(filePath) === storageDirectory) rmSync(filePath, { force: true });
  }
}
