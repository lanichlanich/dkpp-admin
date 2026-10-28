import "server-only";
import { randomUUID } from "node:crypto";
import { database as db } from "@/lib/database";
import { createStorageUploadUrl, deleteStorageObject, downloadStorageObject } from "@/lib/storage";
import { MAX_ARCHIVE_UPLOAD_SIZE_BYTES, MAX_ARCHIVE_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

export class ArchiveUploadError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}

export function validateArchivePdf(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_ARCHIVE_UPLOAD_SIZE_BYTES)
    throw new ArchiveUploadError(`Ukuran PDF maksimal ${MAX_ARCHIVE_UPLOAD_SIZE_MB} MB.`, 413);
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-")
    throw new ArchiveUploadError("Berkas yang diunggah harus PDF yang valid.");
}

async function cleanupExpiredUploads() {
  // Signed upload URLs last two hours. Only remove expired, uncommitted objects
  // after an additional hour, so an in-flight finalization cannot lose its file.
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const expired = await db.prepare(`SELECT id, storage_name FROM service_archive_uploads
    WHERE expires_at < ? AND NOT EXISTS (SELECT 1 FROM service_archive_documents d WHERE d.id = service_archive_uploads.id)
    ORDER BY expires_at LIMIT 20`).all<{ id: string; storage_name: string }>(cutoff);
  for (const upload of expired) {
    await deleteStorageObject(upload.storage_name);
    await db.prepare("DELETE FROM service_archive_uploads WHERE id = ?").run(upload.id);
  }
}

export async function prepareArchiveUpload(userId: string, fileSize: number) {
  if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_ARCHIVE_UPLOAD_SIZE_BYTES)
    throw new ArchiveUploadError(`Ukuran PDF maksimal ${MAX_ARCHIVE_UPLOAD_SIZE_MB} MB.`, 413);
  await cleanupExpiredUploads().catch(() => console.error("Pembersihan unggahan arsip sementara belum berhasil."));
  const id = randomUUID(), storageName = `${id}.pdf`;
  const uploadUrl = await createStorageUploadUrl(storageName);
  const now = new Date().toISOString(), expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await db.prepare(`INSERT INTO service_archive_uploads (id, user_id, storage_name, file_size, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(id, userId, storageName, fileSize, expiresAt, now);
  return { uploadId: id, uploadUrl, expiresAt };
}

export async function readArchiveUpload(userId: string, uploadId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(uploadId)) throw new ArchiveUploadError("Unggahan arsip tidak valid.");
  const upload = await db.prepare(`SELECT id, storage_name, file_size FROM service_archive_uploads
    WHERE id = ? AND user_id = ? AND expires_at > ?`).get<{ id: string; storage_name: string; file_size: number }>(uploadId, userId, new Date().toISOString());
  if (!upload || upload.storage_name !== `${uploadId}.pdf`) throw new ArchiveUploadError("Unggahan sudah kedaluwarsa atau tidak tersedia. Pilih ulang PDF.");
  let bytes: Buffer;
  try { bytes = await downloadStorageObject(upload.storage_name); }
  catch { throw new ArchiveUploadError("PDF belum selesai diunggah. Pilih ulang PDF lalu coba kembali."); }
  validateArchivePdf(bytes);
  if (bytes.length !== Number(upload.file_size)) throw new ArchiveUploadError("Ukuran PDF berbeda dari unggahan awal. Pilih ulang PDF.");
  return { ...upload, bytes };
}
