import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const database = new Database(path.join(process.cwd(), "data", "admin.db"));
const storageDirectory = path.resolve(process.cwd(), "data", "employee-documents");
const userId = `document-smoke-${randomUUID()}`;
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const now = new Date();
const expiresAt = new Date(now.getTime() + 120_000);
const samplePdf = Buffer.from("%PDF-1.4\n% Employee document smoke test\n%%EOF\n");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function uploadForm(documentType, { includeServicePeriod }) {
  const formData = new FormData();
  formData.set("documentType", documentType);
  formData.set("nomorSurat", documentType === "dokumen_lainnya" ? "Ijazah Terakhir" : `SMOKE/${randomUUID()}`);
  formData.set("tglSurat", "2026-01-02");
  formData.set("tmtSurat", "2026-02-01");
  if (includeServicePeriod) formData.set("masaKerja", "1 Tahun 2 Bulan");
  formData.set("file", new File([samplePdf], "dokumen-smoke.pdf", { type: "application/pdf" }));
  return formData;
}

async function upload(nip, documentType, includeServicePeriod) {
  return fetch(`${baseUrl}/api/employees/${nip}/documents`, {
    method: "POST",
    headers: { Cookie: `admin_session=${token}` },
    body: uploadForm(documentType, { includeServicePeriod }),
  });
}

async function uploadSkp(nip, overrides = {}) {
  const formData = new FormData();
  formData.set("documentType", "sasaran_kinerja_pegawai");
  formData.set("tahun", "2026");
  formData.set("penilaianKinerja", "SESUAI EKSPEKTASI");
  formData.set("penilaianPerilaku", "DIATAS EKSPEKTASI");
  formData.set("predikatSkp", "SANGAT BAIK");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  formData.set("file", new File([samplePdf], "skp-smoke.pdf", { type: "application/pdf" }));
  return fetch(`${baseUrl}/api/employees/${nip}/documents`, {
    method: "POST",
    headers: { Cookie: `admin_session=${token}` },
    body: formData,
  });
}

try {
  const pns = database.prepare("SELECT nip, name FROM employees WHERE asn_type = 'PNS' LIMIT 1").get();
  const pppk = database.prepare("SELECT nip FROM employees WHERE asn_type = 'PPPK' LIMIT 1").get();
  const pppkPw = database.prepare("SELECT nip FROM employees WHERE asn_type = 'PPPK PW' LIMIT 1").get();
  assert(pns && pppk && pppkPw, "Data pegawai PNS, PPPK, dan PPPK PW untuk smoke test tidak tersedia.");

  database.prepare(
    `INSERT INTO users (id, name, username, email, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(userId, "Employee Document Smoke Test", userId, `${userId}@example.test`, "not-used", now.toISOString(), now.toISOString());
  database.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(tokenHash, userId, expiresAt.toISOString(), now.toISOString());

  const pnsUpload = await upload(pns.nip, "sk_cpns", true);
  const pnsPayload = await pnsUpload.json();
  assert(pnsUpload.status === 201, `Unggah SK CPNS gagal (${pnsUpload.status}): ${pnsPayload.message ?? ""}`);
  assert(pnsPayload.document?.masaKerja === "1 Tahun 2 Bulan", "Masa kerja SK CPNS tidak tersimpan.");
  assert(pnsPayload.document?.fileName === `SK-CPNS-${pns.nip}.pdf`, "Nama file SK CPNS tidak dibuat otomatis.");

  const secondPnsUpload = await upload(pns.nip, "sk_cpns", true);
  const secondPnsPayload = await secondPnsUpload.json();
  assert(secondPnsUpload.status === 201, `Unggah SK CPNS kedua gagal (${secondPnsUpload.status}): ${secondPnsPayload.message ?? ""}`);

  const rejectedPnsType = await upload(pns.nip, "sk_kontrak_pppk", false);
  assert(rejectedPnsType.status === 422, "PNS tidak menolak jenis SK Kontrak PPPK.");

  const pppkUpload = await upload(pppk.nip, "sk_kontrak_pppk", false);
  const pppkPayload = await pppkUpload.json();
  assert(pppkUpload.status === 201, `Unggah SK Kontrak PPPK gagal (${pppkUpload.status}): ${pppkPayload.message ?? ""}`);
  assert(pppkPayload.document?.masaKerja === null, "SK Kontrak PPPK menyimpan masa kerja yang tidak diperlukan.");
  assert(pppkPayload.document?.fileName === `SK-KONTRAK-PPPK-${pppk.nip}.pdf`, "Nama file SK Kontrak PPPK tidak dibuat otomatis.");

  const rejectedPppkType = await upload(pppk.nip, "sk_pns_pertama", true);
  assert(rejectedPppkType.status === 422, "PPPK tidak menolak jenis SK PNS Pertama.");

  for (const employee of [pns, pppk, pppkPw]) {
    const otherUpload = await upload(employee.nip, "dokumen_lainnya", false);
    const otherPayload = await otherUpload.json();
    assert(otherUpload.status === 201, `Unggah Dokumen Lainnya gagal (${otherUpload.status}): ${otherPayload.message ?? ""}`);
    assert(otherPayload.document?.masaKerja === null, "Dokumen Lainnya menyimpan masa kerja yang tidak diperlukan.");
    assert(otherPayload.document?.fileName === `Ijazah Terakhir_${employee.nip}.pdf`, "Nama file Dokumen Lainnya tidak menggunakan format Nama Dokumen_NIP.");
  }

  let pnsSkpPayload;
  for (const employee of [pns, pppk, pppkPw]) {
    const skpUpload = await uploadSkp(employee.nip);
    const skpPayload = await skpUpload.json();
    assert(skpUpload.status === 201, `Unggah SKP gagal untuk ${employee.nip} (${skpUpload.status}): ${skpPayload.message ?? ""}`);
    assert(skpPayload.document?.tahun === 2026, "Tahun SKP tidak tersimpan.");
    assert(skpPayload.document?.penilaianKinerja === "SESUAI EKSPEKTASI", "Penilaian kinerja SKP tidak tersimpan.");
    assert(skpPayload.document?.penilaianPerilaku === "DIATAS EKSPEKTASI", "Penilaian perilaku SKP tidak tersimpan.");
    assert(skpPayload.document?.predikatSkp === "SANGAT BAIK", "Predikat SKP tidak tersimpan.");
    assert(skpPayload.document?.fileName === `SKP-2026_${employee.nip}.pdf`, "Nama file SKP tidak dibuat otomatis.");
    if (employee.nip === pns.nip) pnsSkpPayload = skpPayload;
  }

  const invalidSkpUpload = await uploadSkp(pns.nip, { predikatSkp: "CUKUP" });
  assert(invalidSkpUpload.status === 422, "Predikat SKP di luar pilihan tidak ditolak.");

  const listResponse = await fetch(`${baseUrl}/api/employees/${pns.nip}/documents`, {
    headers: { Cookie: `admin_session=${token}` },
  });
  const listPayload = await listResponse.json();
  assert(listResponse.status === 200, "Daftar dokumen pegawai gagal dimuat.");
  assert(listPayload.documents.some((document) => document.id === pnsPayload.document.id), "SK CPNS tidak muncul di daftar dokumen.");
  assert(listPayload.documents.some((document) => document.id === pnsSkpPayload.document.id), "SKP tidak muncul di daftar dokumen.");

  const unauthorizedArchiveResponse = await fetch(`${baseUrl}/api/employees/${pns.nip}/documents/archive`);
  assert(unauthorizedArchiveResponse.status === 401, "Unduh semua dokumen tanpa sesi tidak ditolak.");

  const archiveResponse = await fetch(`${baseUrl}/api/employees/${pns.nip}/documents/archive`, {
    headers: { Cookie: `admin_session=${token}` },
  });
  const archiveBytes = Buffer.from(await archiveResponse.arrayBuffer());
  assert(archiveResponse.status === 200, "Unduh semua dokumen pegawai gagal.");
  assert(archiveResponse.headers.get("content-type") === "application/zip", "Tipe respons arsip bukan ZIP.");
  const expectedArchiveName = `${pns.nip}_${pns.name}.zip`;
  assert(
    archiveResponse.headers.get("content-disposition")?.includes(`filename*=UTF-8''${encodeURIComponent(expectedArchiveName)}`),
    "Nama arsip tidak menggunakan format NIP_Nama Pegawai.zip.",
  );
  const archive = new PizZip(archiveBytes);
  const archivedFileNames = Object.values(archive.files).filter((file) => !file.dir).map((file) => file.name);
  assert(archivedFileNames.includes(`SK-CPNS-${pns.nip}.pdf`), "SK CPNS tidak masuk ke dalam arsip ZIP.");
  assert(archivedFileNames.includes(`SK-CPNS-${pns.nip}-2.pdf`), "SK CPNS kedua tertimpa di dalam arsip ZIP.");
  assert(archivedFileNames.includes(`Ijazah Terakhir_${pns.nip}.pdf`), "Dokumen Lainnya tidak masuk ke dalam arsip ZIP dengan nama yang benar.");
  assert(archivedFileNames.includes(`SKP-2026_${pns.nip}.pdf`), "Dokumen SKP tidak masuk ke dalam arsip ZIP.");
  for (const fileName of archivedFileNames) {
    assert(archive.file(fileName)?.asNodeBuffer().equals(samplePdf), `Isi ${fileName} di dalam ZIP tidak sesuai.`);
  }

  const downloadResponse = await fetch(
    `${baseUrl}/api/employees/${pns.nip}/documents/${pnsPayload.document.id}/download`,
    { headers: { Cookie: `admin_session=${token}` } },
  );
  const downloaded = Buffer.from(await downloadResponse.arrayBuffer());
  assert(downloadResponse.status === 200, "Unduh dokumen pegawai gagal.");
  assert(downloaded.equals(samplePdf), "Isi file unduhan berbeda dari file unggahan.");

  const pnsStorage = database.prepare(
    "SELECT storage_name FROM employee_documents WHERE id = ?",
  ).get(pnsPayload.document.id);
  assert(pnsStorage, "Metadata penyimpanan SK CPNS tidak ditemukan sebelum penghapusan.");
  const pnsFilePath = path.resolve(storageDirectory, pnsStorage.storage_name);
  assert(existsSync(pnsFilePath), "File SK CPNS tidak ditemukan sebelum penghapusan.");

  const deleteResponse = await fetch(
    `${baseUrl}/api/employees/${pns.nip}/documents/${pnsPayload.document.id}`,
    { method: "DELETE", headers: { Cookie: `admin_session=${token}` } },
  );
  assert(deleteResponse.status === 200, `Hapus dokumen gagal (${deleteResponse.status}).`);
  assert(!database.prepare("SELECT 1 FROM employee_documents WHERE id = ?").get(pnsPayload.document.id), "Metadata dokumen masih tersimpan setelah dihapus.");
  assert(!existsSync(pnsFilePath), "File fisik masih tersimpan setelah dihapus.");

  const deletedDownloadResponse = await fetch(
    `${baseUrl}/api/employees/${pns.nip}/documents/${pnsPayload.document.id}/download`,
    { headers: { Cookie: `admin_session=${token}` } },
  );
  assert(deletedDownloadResponse.status === 404, "Dokumen yang dihapus masih dapat diunduh.");

  console.log("Smoke test berhasil: SKP dan Dokumen Lainnya untuk semua ASN serta validasi, arsip ZIP, unduh, dan hapus tervalidasi.");
} finally {
  const files = database.prepare("SELECT storage_name FROM employee_documents WHERE user_id = ?").all(userId);
  database.prepare("DELETE FROM employee_documents WHERE user_id = ?").run(userId);
  database.prepare("DELETE FROM users WHERE id = ?").run(userId);
  database.close();
  for (const { storage_name: storageName } of files) {
    if (!/^[0-9a-f-]{36}\.(pdf|doc|docx)$/i.test(storageName)) continue;
    const filePath = path.resolve(storageDirectory, storageName);
    if (path.dirname(filePath) === storageDirectory) rmSync(filePath, { force: true });
  }
}
