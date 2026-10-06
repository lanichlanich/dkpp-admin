import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { database as db } from "@/lib/database";
import { isStorageConfigured, uploadStorageObject } from "@/lib/storage";

export type SuratLupaAbsenEmployee = {
  nip: string;
  name: string;
  position: string;
  unit?: string;
};

export const suratLupaAbsenSchema = z.object({
  employeeNip: z.string().trim().min(1, "Pilih pegawai."),
  absenceDate: z.iso.date(),
  letterDate: z.iso.date(),
  reason: z.string().trim().min(3, "Isi alasan lupa absen pulang.").max(250, "Alasan maksimal 250 karakter.")
    .regex(/^[^\r\n<>]+$/, "Alasan harus berupa satu baris tanpa tanda kurung sudut."),
  supervisorNip: z.string().trim().min(1, "Pilih atasan yang mengetahui."),
}).refine((input) => input.employeeNip !== input.supervisorNip, {
  path: ["supervisorNip"], message: "Atasan harus berbeda dari pegawai yang membuat surat.",
});

const directory = path.join(process.cwd(), "data", "surat-lupa-absen-documents");
const storageNamePattern = /^[0-9a-f-]{36}\.docx$/i;

export async function getEmployeesForSuratLupaAbsen(): Promise<SuratLupaAbsenEmployee[]> {
  return await db.prepare(
    "SELECT nip, name, position, unit FROM employees WHERE status = 'Aktif' ORDER BY name COLLATE NOCASE",
  ).all() as SuratLupaAbsenEmployee[];
}

export async function saveSuratLupaAbsenDocument(input: {
  userId: string;
  employee: SuratLupaAbsenEmployee;
  absenceDate: string;
  letterDate: string;
  reason: string;
  supervisor: SuratLupaAbsenEmployee;
  document: Buffer;
}) {
  const id = randomUUID();
  const storageName = `${id}.docx`;
  const fileName = `Surat-Lupa-Absen-Pulang-${input.employee.nip}-${input.letterDate}.docx`;
  const filePath = path.join(directory, storageName);
  const local = !isStorageConfigured();
  if (local) {
    await mkdir(directory, { recursive: true });
    await writeFile(filePath, input.document, { flag: "wx" });
  }
  try {
    await uploadStorageObject(storageName, input.document, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    await db.prepare(`INSERT INTO surat_lupa_absen_documents
      (id, user_id, employee_nip, employee_name, employee_position, absence_date, letter_date,
       reason, supervisor_nip, supervisor_name, supervisor_position, file_name, storage_name,
       file_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, input.userId, input.employee.nip, input.employee.name, input.employee.position,
        input.absenceDate, input.letterDate, input.reason, input.supervisor.nip, input.supervisor.name,
        input.supervisor.position, fileName, storageName, input.document.length, new Date().toISOString());
  } catch (error) {
    if (local) await rm(filePath, { force: true });
    throw error;
  }
  return { id, fileName };
}

export type SuratLupaAbsenHistoryItem = {
  id: string;
  employeeName: string;
  employeeNip: string;
  absenceDate: string;
  letterDate: string;
  supervisorName: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  createdBy: string;
};

export async function getSuratLupaAbsenHistory(): Promise<SuratLupaAbsenHistoryItem[]> {
  const rows = await db.prepare(`SELECT d.id, d.employee_name, d.employee_nip,
    CAST(d.absence_date AS TEXT) AS absence_date, CAST(d.letter_date AS TEXT) AS letter_date,
    d.supervisor_name, d.file_name, d.file_size, d.created_at, u.name AS created_by
    FROM surat_lupa_absen_documents AS d JOIN users AS u ON u.id = d.user_id
    ORDER BY d.created_at DESC`).all() as Array<{
      id: string; employee_name: string; employee_nip: string; absence_date: string; letter_date: string;
      supervisor_name: string; file_name: string; file_size: number; created_at: string; created_by: string;
    }>;
  return rows.map((row) => ({
    id: row.id, employeeName: row.employee_name, employeeNip: row.employee_nip,
    absenceDate: row.absence_date, letterDate: row.letter_date, supervisorName: row.supervisor_name,
    fileName: row.file_name, fileSize: row.file_size, createdAt: row.created_at, createdBy: row.created_by,
  }));
}

export async function getSuratLupaAbsenDownload(id: string) {
  const row = await db.prepare("SELECT file_name, storage_name FROM surat_lupa_absen_documents WHERE id = ?")
    .get(id) as { file_name: string; storage_name: string } | undefined;
  if (!row || !storageNamePattern.test(row.storage_name)) return null;
  return { fileName: row.file_name, storageName: row.storage_name, filePath: path.join(directory, row.storage_name) };
}
