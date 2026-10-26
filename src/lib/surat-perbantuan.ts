import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { database as db } from "@/lib/database";
import { deleteStorageObject, isStorageConfigured, uploadStorageObject } from "@/lib/storage";
import { MAX_UPLOAD_SIZE_BYTES } from "@/lib/upload-limits";
import { perbantuanRank, type SuratPerbantuanEmployee, type SuratPerbantuanInput } from "@/lib/surat-perbantuan-validation";

const directory = path.join(process.cwd(), "data", "surat-perbantuan-documents");
const storageNamePattern = /^[0-9a-f-]{36}\.docx$/i;

export async function getEmployeesForSuratPerbantuan(): Promise<SuratPerbantuanEmployee[]> {
  return db.prepare(`SELECT nip, name, rank, position, unit, asn_type AS asnType
    FROM employees WHERE status = 'Aktif' ORDER BY name COLLATE NOCASE`).all<SuratPerbantuanEmployee>();
}

export async function getEmployeeForSuratPerbantuan(nip: string) {
  return db.prepare(`SELECT nip, name, rank, position, unit, asn_type AS asnType
    FROM employees WHERE nip = ? AND status = 'Aktif'`).get<SuratPerbantuanEmployee>(nip);
}

export async function saveSuratPerbantuanDocument(input: {
  userId: string;
  values: SuratPerbantuanInput;
  employee: SuratPerbantuanEmployee;
  document: Buffer;
}) {
  if (!input.document.length || input.document.length > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error("Ukuran dokumen surat perbantuan tidak valid.");
  }
  const id = randomUUID();
  const storageName = `${id}.docx`;
  const fileName = `Surat-Perbantuan-${input.employee.nip}-${input.values.tanggalSurat}.docx`;
  const filePath = path.join(directory, storageName);
  const local = !isStorageConfigured();
  const { pangkat, golongan } = perbantuanRank(input.employee.rank);
  let uploaded = false;
  if (local) {
    await mkdir(directory, { recursive: true });
    await writeFile(filePath, input.document, { flag: "wx" });
  }
  try {
    await uploadStorageObject(storageName, input.document, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    uploaded = !local;
    await db.prepare(`INSERT INTO surat_perbantuan_documents
      (id, user_id, employee_nip, employee_name, employee_rank, employee_grade, employee_position,
       employee_unit, nomor_surat, tanggal_surat, jabatan_perbantuan, unit_kerja_perbantuan,
       file_name, storage_name, file_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, input.userId, input.employee.nip, input.employee.name, pangkat, golongan,
        input.employee.position, input.employee.unit, input.values.nomorSurat, input.values.tanggalSurat,
        input.values.jabatanPerbantuan, input.values.unitKerjaPerbantuan,
        fileName, storageName, input.document.length, new Date().toISOString());
  } catch (error) {
    if (local) await rm(filePath, { force: true });
    if (uploaded) {
      try { await deleteStorageObject(storageName); }
      catch (cleanupError) { console.error("Surat perbantuan storage cleanup failed", cleanupError); }
    }
    throw error;
  }
  return { id, fileName };
}

export type SuratPerbantuanHistoryItem = {
  id: string;
  employeeName: string;
  employeeNip: string;
  nomorSurat: string;
  tanggalSurat: string;
  jabatanPerbantuan: string;
  unitKerjaPerbantuan: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  createdBy: string;
};

export async function getSuratPerbantuanHistory(): Promise<SuratPerbantuanHistoryItem[]> {
  return db.prepare(`SELECT d.id, d.employee_name AS employeeName, d.employee_nip AS employeeNip,
    d.nomor_surat AS nomorSurat, CAST(d.tanggal_surat AS TEXT) AS tanggalSurat,
    d.jabatan_perbantuan AS jabatanPerbantuan, d.unit_kerja_perbantuan AS unitKerjaPerbantuan,
    d.file_name AS fileName, d.file_size AS fileSize, d.created_at AS createdAt, u.name AS createdBy
    FROM surat_perbantuan_documents AS d JOIN users AS u ON u.id = d.user_id
    ORDER BY d.created_at DESC`).all<SuratPerbantuanHistoryItem>();
}

export async function getSuratPerbantuanDownload(id: string) {
  const row = await db.prepare("SELECT file_name, storage_name FROM surat_perbantuan_documents WHERE id = ?")
    .get<{ file_name: string; storage_name: string }>(id);
  if (!row || !storageNamePattern.test(row.storage_name)) return null;
  return { fileName: row.file_name, storageName: row.storage_name, filePath: path.join(directory, row.storage_name) };
}
