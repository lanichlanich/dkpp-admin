import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";

const storageDirectory = path.join(process.cwd(), "data", "kgb-documents");

export type KgbDocumentHistory = {
  id: string;
  employeeNip: string;
  employeeName: string;
  nomorSurat: string;
  tglSurat: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  createdBy: string;
};

export async function saveKgbDocument({
  userId,
  employeeNip,
  employeeName,
  nomorSurat,
  tglSurat,
  document,
}: {
  userId: string;
  employeeNip: string;
  employeeName: string;
  nomorSurat: string;
  tglSurat: string;
  document: Buffer;
}) {
  const id = randomUUID();
  const storageName = `${id}.docx`;
  const fileName = `SK-KGB-${employeeNip}-${tglSurat}.docx`;
  const filePath = path.join(storageDirectory, storageName);
  const createdAt = new Date().toISOString();

  await mkdir(storageDirectory, { recursive: true });
  await writeFile(filePath, document, { flag: "wx" });
  try {
    await db.prepare(
      `INSERT INTO kgb_documents (
        id, user_id, employee_nip, employee_name, nomor_surat, tgl_surat,
        file_name, storage_name, file_size, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, userId, employeeNip, employeeName, nomorSurat, tglSurat,
      fileName, storageName, document.length, createdAt,
    );
  } catch (error) {
    await rm(filePath, { force: true });
    throw error;
  }

  return { id, fileName };
}

export async function getKgbHistory(): Promise<KgbDocumentHistory[]> {
  await requireUser();
  const rows = await db.prepare(
    `SELECT
      documents.id,
      documents.employee_nip,
      documents.employee_name,
      documents.nomor_surat,
      documents.tgl_surat,
      documents.file_name,
      documents.file_size,
      documents.created_at,
      users.name AS created_by
     FROM kgb_documents AS documents
     INNER JOIN users ON users.id = documents.user_id
     ORDER BY documents.created_at DESC`,
  ).all() as Array<{
    id: string;
    employee_nip: string;
    employee_name: string;
    nomor_surat: string;
    tgl_surat: string;
    file_name: string;
    file_size: number;
    created_at: string;
    created_by: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    employeeNip: row.employee_nip,
    employeeName: row.employee_name,
    nomorSurat: row.nomor_surat,
    tglSurat: row.tgl_surat,
    fileName: row.file_name,
    fileSize: row.file_size,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));
}

export async function getKgbDocumentForDownload(id: string) {
  const row = await db.prepare(
    `SELECT file_name, storage_name, file_size
     FROM kgb_documents WHERE id = ?`,
  ).get(id) as { file_name: string; storage_name: string; file_size: number } | undefined;
  if (!row || !/^[0-9a-f-]{36}\.docx$/i.test(row.storage_name)) return null;
  return {
    fileName: row.file_name,
    fileSize: row.file_size,
    storageName: row.storage_name,
    filePath: path.join(storageDirectory, row.storage_name),
  };
}
