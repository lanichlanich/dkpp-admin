import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";
import { isStorageConfigured, uploadStorageObject } from "@/lib/storage";

const storageDirectory = path.join(process.cwd(), "data", "wfh-documents");

export type WfhDocumentHistory = {
  id: string;
  nomorSurat: string;
  bulanWfh: string;
  tanggalSurat: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  createdBy: string;
};

export async function saveWfhDocument({
  userId,
  nomorSurat,
  bulanWfh,
  tanggalSurat,
  document,
}: {
  userId: string;
  nomorSurat: string;
  bulanWfh: string;
  tanggalSurat: string;
  document: Buffer;
}) {
  const id = randomUUID();
  const storageName = `${id}.docx`;
  const fileName = `Surat-Tugas-WFH-${tanggalSurat}.docx`;
  const filePath = path.join(storageDirectory, storageName);
  const createdAt = new Date().toISOString();

  const localStorageEnabled = !isStorageConfigured();
  if (localStorageEnabled) {
    await mkdir(storageDirectory, { recursive: true });
    await writeFile(filePath, document, { flag: "wx" });
  }
  try {
    await uploadStorageObject(storageName, document, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    await db.prepare(
      `INSERT INTO wfh_documents (
        id, user_id, nomor_surat, bulan_wfh, tanggal_surat,
        file_name, storage_name, file_size, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      nomorSurat,
      bulanWfh,
      tanggalSurat,
      fileName,
      storageName,
      document.length,
      createdAt,
    );
  } catch (error) {
    if (localStorageEnabled) await rm(filePath, { force: true });
    throw error;
  }

  return { id, fileName };
}

export async function getWfhHistory(): Promise<WfhDocumentHistory[]> {
  await requireUser();
  const rows = await db.prepare(
    `SELECT
      documents.id,
      documents.nomor_surat,
      documents.bulan_wfh,
      documents.tanggal_surat,
      documents.file_name,
      documents.file_size,
      documents.created_at,
      users.name AS created_by
     FROM wfh_documents AS documents
     INNER JOIN users ON users.id = documents.user_id
     ORDER BY documents.created_at DESC`,
  ).all() as Array<{
    id: string;
    nomor_surat: string;
    bulan_wfh: string;
    tanggal_surat: string;
    file_name: string;
    file_size: number;
    created_at: string;
    created_by: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    nomorSurat: row.nomor_surat,
    bulanWfh: row.bulan_wfh,
    tanggalSurat: row.tanggal_surat,
    fileName: row.file_name,
    fileSize: row.file_size,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));
}

export async function getWfhDocumentForDownload(id: string) {
  const row = await db.prepare(
    `SELECT file_name, storage_name, file_size
     FROM wfh_documents WHERE id = ?`,
  ).get(id) as { file_name: string; storage_name: string; file_size: number } | undefined;

  if (!row || !/^[0-9a-f-]{36}\.docx$/i.test(row.storage_name)) return null;
  return {
    fileName: row.file_name,
    fileSize: row.file_size,
    storageName: row.storage_name,
    filePath: path.join(storageDirectory, row.storage_name),
  };
}

export async function deleteWfhDocument(id: string) {
  const row = await db.prepare(
    `SELECT nomor_surat, bulan_wfh, file_name, storage_name
     FROM wfh_documents WHERE id = ?`,
  ).get(id) as {
    nomor_surat: string;
    bulan_wfh: string;
    file_name: string;
    storage_name: string;
  } | undefined;

  if (!row || !/^[0-9a-f-]{36}\.docx$/i.test(row.storage_name)) return null;

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
    const result = await db.prepare("DELETE FROM wfh_documents WHERE id = ?").run(id);
    if (result.changes === 0) {
      if (fileMoved) await rename(pendingDeletionPath, filePath);
      return null;
    }
  } catch (error) {
    if (fileMoved) await rename(pendingDeletionPath, filePath);
    throw error;
  }

  if (fileMoved) await rm(pendingDeletionPath, { force: true });
  return {
    nomorSurat: row.nomor_surat,
    bulanWfh: row.bulan_wfh,
    fileName: row.file_name,
  };
}
