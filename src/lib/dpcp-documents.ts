import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";

const storageDirectory = path.join(process.cwd(), "data", "dpcp-documents");

export type DpcpDocumentHistory = {
  id: string;
  employeeNip: string;
  employeeName: string;
  tglDpcp: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  createdBy: string;
};

export async function saveDpcpDocument({
  userId,
  employeeNip,
  employeeName,
  tglDpcp,
  document,
}: {
  userId: string;
  employeeNip: string;
  employeeName: string;
  tglDpcp: string;
  document: Buffer;
}) {
  const id = randomUUID();
  const storageName = `${id}.docx`;
  const fileName = `DPCP-${employeeNip}-${tglDpcp}.docx`;
  const filePath = path.join(storageDirectory, storageName);
  const createdAt = new Date().toISOString();

  await mkdir(storageDirectory, { recursive: true });
  await writeFile(filePath, document, { flag: "wx" });

  try {
    await db.prepare(
      `INSERT INTO dpcp_documents (
        id, user_id, employee_nip, employee_name, tgl_dpcp,
        file_name, storage_name, file_size, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      employeeNip,
      employeeName,
      tglDpcp,
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

export async function getDpcpHistory(): Promise<DpcpDocumentHistory[]> {
  await requireUser();
  const rows = await db.prepare(
    `SELECT
      documents.id,
      documents.employee_nip,
      documents.employee_name,
      documents.tgl_dpcp,
      documents.file_name,
      documents.file_size,
      documents.created_at,
      users.name AS created_by
     FROM dpcp_documents AS documents
     INNER JOIN users ON users.id = documents.user_id
     ORDER BY documents.created_at DESC`,
  ).all() as Array<{
    id: string;
    employee_nip: string;
    employee_name: string;
    tgl_dpcp: string;
    file_name: string;
    file_size: number;
    created_at: string;
    created_by: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    employeeNip: row.employee_nip,
    employeeName: row.employee_name,
    tglDpcp: row.tgl_dpcp,
    fileName: row.file_name,
    fileSize: row.file_size,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));
}

export async function getDpcpDocumentForDownload(id: string) {
  const row = await db.prepare(
    `SELECT file_name, storage_name, file_size
     FROM dpcp_documents WHERE id = ?`,
  ).get(id) as { file_name: string; storage_name: string; file_size: number } | undefined;

  if (!row || !/^[0-9a-f-]{36}\.docx$/i.test(row.storage_name)) return null;

  return {
    fileName: row.file_name,
    fileSize: row.file_size,
    storageName: row.storage_name,
    filePath: path.join(storageDirectory, row.storage_name),
  };
}
