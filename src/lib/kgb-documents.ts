import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";
import { deleteStorageObject, downloadStorageObject, isStorageConfigured, uploadStorageObject } from "@/lib/storage";
import { kgbSchema, type KgbInput } from "@/lib/kgb-validation";
import { recoverKgbInput } from "@/lib/kgb-input-recovery";
import { buildKgbDocument, KgbArchiveError } from "@/lib/kgb-service";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

const wordDirectory = path.join(process.cwd(), "data", "kgb-documents");
const signedDirectory = path.join(process.cwd(), "data", "kgb-signed-documents");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const storedWord = (name: string) => uuid.test(name.slice(0, -5)) && name.endsWith(".docx");
const contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type KgbSignedDocument = { id: string; documentId: string; documentRevision: number; originalName: string; fileName: string; fileSize: number; pageCount: number; createdAt: string };
export type KgbDocumentHistory = { id: string; employeeNip: string; employeeName: string; nomorSurat: string; tglSurat: string; fileName: string; fileSize: number; createdAt: string; createdBy: string; revision: number; updatedAt: string | null; signedDocuments: KgbSignedDocument[] };

async function writeArchive(name: string, bytes: Buffer, directory: string, type: string) {
  if (isStorageConfigured()) await uploadStorageObject(name, bytes, type);
  else { await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, name), bytes, { flag: "wx" }); }
}
async function removeArchive(name: string, directory: string) {
  if (isStorageConfigured()) await deleteStorageObject(name);
  else await rm(path.join(directory, name), { force: true });
}
async function cleanArchive(name: string, directory: string) {
  await removeArchive(name, directory).catch(() => console.error("Pembersihan berkas KGB belum berhasil."));
}
function expectedRevision(revision: number) {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new KgbArchiveError("Versi dokumen tidak valid.", 400);
}
function conflict() { return new KgbArchiveError("Dokumen sudah berubah. Muat ulang halaman sebelum menyimpan atau mengunggah SK.", 409); }

export async function saveKgbDocument(data: { userId: string; employeeNip: string; employeeName: string; nomorSurat: string; tglSurat: string; document: Buffer; input?: KgbInput }) {
  const id = randomUUID(), storageName = `${id}.docx`, fileName = `SK-KGB-${data.employeeNip}-${data.tglSurat}.docx`, createdAt = new Date().toISOString();
  try {
    await writeArchive(storageName, data.document, wordDirectory, contentType);
    await db.prepare(`INSERT INTO kgb_documents (id, user_id, employee_nip, employee_name, nomor_surat, tgl_surat, file_name, storage_name, file_size, created_at, input_json, revision)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`).run(id, data.userId, data.employeeNip, data.employeeName, data.nomorSurat, data.tglSurat, fileName, storageName, data.document.length, createdAt, data.input ? JSON.stringify(data.input) : null);
  } catch (error) { await cleanArchive(storageName, wordDirectory); throw error; }
  return { id, fileName };
}

export async function getKgbHistory(): Promise<KgbDocumentHistory[]> {
  await requireUser();
  const rows = await db.prepare(`SELECT documents.id, employee_nip, employee_name, nomor_surat, CAST(tgl_surat AS TEXT) AS tgl_surat, file_name, file_size,
    CAST(documents.created_at AS TEXT) AS created_at, users.name AS created_by, revision, CAST(documents.updated_at AS TEXT) AS updated_at
    FROM kgb_documents AS documents INNER JOIN users ON users.id = documents.user_id ORDER BY documents.created_at DESC`)
    .all<{ id: string; employee_nip: string; employee_name: string; nomor_surat: string; tgl_surat: string; file_name: string; file_size: number; created_at: string; created_by: string; revision: number; updated_at: string | null }>();
  const signed = await db.prepare(`SELECT id, document_id AS documentId, document_revision AS documentRevision, original_file_name AS originalName,
    file_name AS fileName, file_size AS fileSize, page_count AS pageCount, CAST(created_at AS TEXT) AS createdAt
    FROM kgb_signed_documents ORDER BY created_at DESC, id DESC`).all<KgbSignedDocument>();
  const byDocument = new Map<string, KgbSignedDocument[]>();
  for (const file of signed) byDocument.set(file.documentId, [...(byDocument.get(file.documentId) ?? []), file]);
  return rows.map(r => ({ id: r.id, employeeNip: r.employee_nip, employeeName: r.employee_name, nomorSurat: r.nomor_surat, tglSurat: r.tgl_surat, fileName: r.file_name,
    fileSize: r.file_size, createdAt: r.created_at, createdBy: r.created_by, revision: r.revision, updatedAt: r.updated_at, signedDocuments: byDocument.get(r.id) ?? [] }));
}

export async function getKgbDocumentForDownload(id: string) {
  if (!uuid.test(id)) return null;
  const row = await db.prepare("SELECT file_name, storage_name, file_size FROM kgb_documents WHERE id = ?")
    .get<{ file_name: string; storage_name: string; file_size: number }>(id);
  if (!row || !storedWord(row.storage_name)) return null;
  return { fileName: row.file_name, fileSize: row.file_size, storageName: row.storage_name, filePath: path.join(wordDirectory, row.storage_name) };
}

export async function getKgbEditData(id: string) {
  if (!uuid.test(id)) return null;
  const row = await db.prepare(`SELECT id, employee_nip, employee_name, nomor_surat, CAST(tgl_surat AS TEXT) AS tgl_surat,
    CAST(input_json AS TEXT) AS input_json, revision, storage_name FROM kgb_documents WHERE id = ?`)
    .get<{ id: string; employee_nip: string; employee_name: string; nomor_surat: string; tgl_surat: string; input_json: string | null; revision: number; storage_name: string }>(id);
  if (!row) return null;
  let input: Partial<KgbInput>;
  if (row.input_json) {
    let value: unknown;
    try { value = JSON.parse(row.input_json); } catch { throw new KgbArchiveError("Data form tersimpan tidak valid. Hubungi administrator.", 500); }
    const parsed = kgbSchema.safeParse(value);
    if (!parsed.success || parsed.data.nip !== row.employee_nip) throw new KgbArchiveError("Data form tersimpan tidak sesuai dokumen. Hubungi administrator.", 500);
    input = parsed.data;
  } else {
    try { input = storedWord(row.storage_name) ? recoverKgbInput(await downloadStorageObject(row.storage_name, path.join(wordDirectory, row.storage_name))) : {}; }
    catch { input = {}; }
  }
  return { id: row.id, employeeName: row.employee_name, revision: row.revision, legacy: !row.input_json, input: { ...input, nip: row.employee_nip, nomorSurat: row.nomor_surat, tglSurat: row.tgl_surat } };
}

export async function updateKgbDocument(id: string, input: KgbInput, revision: number, userId: string) {
  expectedRevision(revision);
  if (!uuid.test(id)) throw new KgbArchiveError("Dokumen tidak ditemukan.", 404);
  const row = await db.prepare("SELECT employee_nip, revision, storage_name FROM kgb_documents WHERE id = ?")
    .get<{ employee_nip: string; revision: number; storage_name: string }>(id);
  if (!row) throw new KgbArchiveError("Dokumen tidak ditemukan.", 404);
  if (row.revision !== revision) throw conflict();
  if (input.nip !== row.employee_nip) throw new KgbArchiveError("Pegawai pada arsip KGB tidak dapat diganti.");
  const { employee, document } = await buildKgbDocument(input), storageName = `${randomUUID()}.docx`;
  const fileName = `SK-KGB-${employee.nip}-${input.tglSurat}.docx`, now = new Date().toISOString();
  try {
    await writeArchive(storageName, document, wordDirectory, contentType);
    const result = await db.prepare(`UPDATE kgb_documents SET employee_name = ?, nomor_surat = ?, tgl_surat = ?, input_json = ?, file_name = ?, storage_name = ?, file_size = ?,
      revision = revision + 1, updated_at = ?, updated_by = ? WHERE id = ? AND revision = ?`)
      .run(employee.name, input.nomorSurat, input.tglSurat, JSON.stringify(input), fileName, storageName, document.length, now, userId, id, revision);
    if (!result.changes) throw conflict();
  } catch (error) { await cleanArchive(storageName, wordDirectory); throw error; }
  if (storedWord(row.storage_name)) await cleanArchive(row.storage_name, wordDirectory);
  return { document, fileName, revision: revision + 1 };
}

export async function saveSignedKgb(id: string, revision: number, userId: string, originalName: string, bytes: Buffer) {
  expectedRevision(revision);
  if (!uuid.test(id)) throw new KgbArchiveError("Dokumen tidak ditemukan.", 404);
  const row = await db.prepare("SELECT employee_nip, CAST(tgl_surat AS TEXT) AS tgl_surat, revision FROM kgb_documents WHERE id = ?")
    .get<{ employee_nip: string; tgl_surat: string; revision: number }>(id);
  if (!row) throw new KgbArchiveError("Dokumen tidak ditemukan.", 404);
  if (row.revision !== revision) throw conflict();
  if (!bytes.length || bytes.length > MAX_UPLOAD_SIZE_BYTES) throw new KgbArchiveError(`Ukuran PDF maksimal ${MAX_UPLOAD_SIZE_MB} MB.`, 413);
  if (!/\.pdf$/i.test(originalName) || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new KgbArchiveError("SK bertanda tangan harus berupa PDF yang valid.");
  let pageCount: number;
  try { pageCount = (await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true })).getPageCount(); if (!pageCount) throw new Error("Empty PDF"); }
  catch { throw new KgbArchiveError("PDF tidak dapat dibaca. Gunakan file yang tidak rusak dan tidak dilindungi kata sandi."); }
  const signedId = randomUUID(), storageName = `${signedId}.pdf`, now = new Date().toISOString();
  const safeName = originalName.replaceAll("\\", "/").split("/").pop()!.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180) || "SK-KGB-TTD.pdf";
  const fileName = `SK-KGB-TTD-${row.employee_nip}-${row.tgl_surat}-v${revision}.pdf`;
  try {
    // Preserve the uploaded PDF bytes, including any existing electronic signature.
    await writeArchive(storageName, bytes, signedDirectory, "application/pdf");
    const inserted = await db.prepare(`INSERT INTO kgb_signed_documents (id, document_id, document_revision, user_id, original_file_name, file_name, storage_name, file_size, page_count, created_at)
      SELECT ?, id, revision, ?, ?, ?, ?, ?, ?, ? FROM kgb_documents WHERE id = ? AND revision = ?`)
      .run(signedId, userId, safeName, fileName, storageName, bytes.length, pageCount, now, id, revision);
    if (!inserted.changes) throw conflict();
  } catch (error) { await cleanArchive(storageName, signedDirectory); throw error; }
  return { id: signedId, documentId: id, documentRevision: revision, originalName: safeName, fileName, fileSize: bytes.length, pageCount, createdAt: now } satisfies KgbSignedDocument;
}

export async function readSignedKgb(documentId: string, id: string) {
  if (!uuid.test(documentId) || !uuid.test(id)) return null;
  const row = await db.prepare("SELECT file_name, storage_name FROM kgb_signed_documents WHERE id = ? AND document_id = ?")
    .get<{ file_name: string; storage_name: string }>(id, documentId);
  if (!row || row.storage_name !== `${id}.pdf`) return null;
  return { bytes: await downloadStorageObject(row.storage_name, path.join(signedDirectory, row.storage_name)), fileName: row.file_name };
}
