import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";

const storageDirectory = path.join(process.cwd(), "data", "surat-pengantar-documents");
const storageNamePattern = /^[0-9a-f-]{36}\.docx$/i;

export type SuratPengantarDocumentHistory = {
  id: string;
  nomorSurat: string;
  tanggalSurat: string;
  nomorUrut: number;
  fileYangDikirim: string;
  jumlah: number;
  fileName: string;
  fileSize: number;
  createdAt: string;
  createdBy: string;
};

export async function saveSuratPengantarDocument({
  userId,
  nomorSurat,
  tanggalSurat,
  nomorUrut,
  fileYangDikirim,
  jumlah,
  document,
}: {
  userId: string;
  nomorSurat: string;
  tanggalSurat: string;
  nomorUrut: number;
  fileYangDikirim: string;
  jumlah: number;
  document: Buffer;
}) {
  const id = randomUUID();
  const storageName = `${id}.docx`;
  const fileName = `Surat-Pengantar-${tanggalSurat}.docx`;
  const filePath = path.join(storageDirectory, storageName);
  const createdAt = new Date().toISOString();

  await mkdir(storageDirectory, { recursive: true });
  await writeFile(filePath, document, { flag: "wx" });
  try {
    await db.prepare(
      `INSERT INTO surat_pengantar_documents (
        id, user_id, nomor_surat, tanggal_surat, nomor_urut,
        file_yang_dikirim, jumlah, file_name, storage_name, file_size, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      nomorSurat,
      tanggalSurat,
      nomorUrut,
      fileYangDikirim,
      jumlah,
      fileName,
      storageName,
      document.length,
      createdAt,
    );
  } catch (error) {
    await rm(filePath, { force: true });
    throw error;
  }

  return { id, fileName };
}

export async function getSuratPengantarHistory(): Promise<SuratPengantarDocumentHistory[]> {
  await requireUser();
  const rows = await db.prepare(
    `SELECT
      documents.id,
      documents.nomor_surat,
      documents.tanggal_surat,
      documents.nomor_urut,
      documents.file_yang_dikirim,
      documents.jumlah,
      documents.file_name,
      documents.file_size,
      documents.created_at,
      users.name AS created_by
     FROM surat_pengantar_documents AS documents
     INNER JOIN users ON users.id = documents.user_id
     ORDER BY documents.created_at DESC`,
  ).all() as Array<{
    id: string;
    nomor_surat: string;
    tanggal_surat: string;
    nomor_urut: number;
    file_yang_dikirim: string;
    jumlah: number;
    file_name: string;
    file_size: number;
    created_at: string;
    created_by: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    nomorSurat: row.nomor_surat,
    tanggalSurat: row.tanggal_surat,
    nomorUrut: row.nomor_urut,
    fileYangDikirim: row.file_yang_dikirim,
    jumlah: row.jumlah,
    fileName: row.file_name,
    fileSize: row.file_size,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));
}

export async function getSuratPengantarDocumentForDownload(id: string) {
  const row = await db.prepare(
    `SELECT file_name, storage_name, file_size
     FROM surat_pengantar_documents WHERE id = ?`,
  ).get(id) as { file_name: string; storage_name: string; file_size: number } | undefined;
  if (!row || !storageNamePattern.test(row.storage_name)) return null;
  return {
    fileName: row.file_name,
    fileSize: row.file_size,
    filePath: path.join(storageDirectory, row.storage_name),
  };
}

export async function deleteSuratPengantarDocument(id: string) {
  const row = await db.prepare(
    `SELECT nomor_surat, file_name, storage_name
     FROM surat_pengantar_documents WHERE id = ?`,
  ).get(id) as { nomor_surat: string; file_name: string; storage_name: string } | undefined;
  if (!row || !storageNamePattern.test(row.storage_name)) return null;

  const filePath = path.join(storageDirectory, row.storage_name);
  const pendingDeletionPath = `${filePath}.deleting-${randomUUID()}`;
  let fileMoved = false;
  try {
    await rename(filePath, pendingDeletionPath);
    fileMoved = true;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }

  try {
    const result = await db.prepare("DELETE FROM surat_pengantar_documents WHERE id = ?").run(id);
    if (result.changes === 0) {
      if (fileMoved) await rename(pendingDeletionPath, filePath);
      return null;
    }
  } catch (error) {
    if (fileMoved) await rename(pendingDeletionPath, filePath);
    throw error;
  }

  if (fileMoved) await rm(pendingDeletionPath, { force: true });
  return { nomorSurat: row.nomor_surat, fileName: row.file_name };
}
