import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { database as db } from "@/lib/database";
import type { OfficialStatementType } from "@/lib/official-statement-validation";
import { requireUser } from "@/lib/session";

const storageDirectory = path.join(process.cwd(), "data", "official-statement-documents");
const storageNamePattern = /^[0-9a-f-]{36}\.docx$/i;

export type OfficialStatementDocumentHistory = {
  id: string;
  documentType: OfficialStatementType;
  employeeNip: string;
  employeeName: string;
  nomorSurat: string;
  tanggalSurat: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  createdBy: string;
};

export async function saveOfficialStatementDocument({
  userId,
  documentType,
  employeeNip,
  employeeName,
  nomorSurat,
  tanggalSurat,
  document,
}: {
  userId: string;
  documentType: OfficialStatementType;
  employeeNip: string;
  employeeName: string;
  nomorSurat: string;
  tanggalSurat: string;
  document: Buffer;
}) {
  const id = randomUUID();
  const storageName = `${id}.docx`;
  const fileName = `Surat-${documentType.toUpperCase()}-${employeeNip}-${tanggalSurat}.docx`;
  const filePath = path.join(storageDirectory, storageName);
  const createdAt = new Date().toISOString();

  await mkdir(storageDirectory, { recursive: true });
  await writeFile(filePath, document, { flag: "wx" });
  try {
    await db.prepare(
      `INSERT INTO official_statement_documents (
        id, user_id, document_type, employee_nip, employee_name,
        nomor_surat, tanggal_surat, file_name, storage_name, file_size, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, userId, documentType, employeeNip, employeeName,
      nomorSurat, tanggalSurat, fileName, storageName, document.length, createdAt,
    );
  } catch (error) {
    await rm(filePath, { force: true });
    throw error;
  }
  return { id, fileName };
}

export async function getOfficialStatementHistory(): Promise<OfficialStatementDocumentHistory[]> {
  await requireUser();
  const rows = await db.prepare(
    `SELECT documents.*, users.name AS created_by
     FROM official_statement_documents AS documents
     INNER JOIN users ON users.id = documents.user_id
     ORDER BY documents.created_at DESC`,
  ).all() as Array<{
    id: string;
    document_type: OfficialStatementType;
    employee_nip: string;
    employee_name: string;
    nomor_surat: string;
    tanggal_surat: string;
    file_name: string;
    file_size: number;
    created_at: string;
    created_by: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    documentType: row.document_type,
    employeeNip: row.employee_nip,
    employeeName: row.employee_name,
    nomorSurat: row.nomor_surat,
    tanggalSurat: row.tanggal_surat,
    fileName: row.file_name,
    fileSize: row.file_size,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));
}

export async function getOfficialStatementDocumentForDownload(id: string) {
  const row = await db.prepare(
    `SELECT file_name, storage_name, file_size
     FROM official_statement_documents WHERE id = ?`,
  ).get(id) as { file_name: string; storage_name: string; file_size: number } | undefined;
  if (!row || !storageNamePattern.test(row.storage_name)) return null;
  return { fileName: row.file_name, fileSize: row.file_size, filePath: path.join(storageDirectory, row.storage_name) };
}

export async function deleteOfficialStatementDocument(id: string) {
  const row = await db.prepare(
    `SELECT document_type, nomor_surat, file_name, storage_name
     FROM official_statement_documents WHERE id = ?`,
  ).get(id) as { document_type: OfficialStatementType; nomor_surat: string; file_name: string; storage_name: string } | undefined;
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
    const result = await db.prepare("DELETE FROM official_statement_documents WHERE id = ?").run(id);
    if (result.changes === 0) {
      if (fileMoved) await rename(pendingDeletionPath, filePath);
      return null;
    }
  } catch (error) {
    if (fileMoved) await rename(pendingDeletionPath, filePath);
    throw error;
  }

  if (fileMoved) await rm(pendingDeletionPath, { force: true });
  return { documentType: row.document_type, nomorSurat: row.nomor_surat, fileName: row.file_name };
}
