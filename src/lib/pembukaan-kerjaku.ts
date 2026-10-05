import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { letterNumberSchema } from "@/lib/letter-number-validation";
import { database as db } from "@/lib/database";
import type { KerjakuEmployee } from "@/lib/pembukaan-kerjaku-document";
import { isStorageConfigured, uploadStorageObject } from "@/lib/storage";

export const kerjakuRequestSchema = z.object({
  tanggalSurat: z.iso.date(),
  nomorSurat: letterNumberSchema,
  bulanDibuka: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/, "Pilih bulan yang valid."),
  employeeNips: z.array(z.string().trim().min(1)).min(1, "Pilih setidaknya satu pegawai.").max(500),
}).refine((value) => new Set(value.employeeNips).size === value.employeeNips.length, {
  path: ["employeeNips"], message: "Pegawai tidak boleh dipilih dua kali.",
});

const directory = path.join(process.cwd(), "data", "kerjaku-request-documents");
const namePattern = /^[0-9a-f-]{36}\.docx$/i;

export async function getEmployeesForKerjaku() {
  return await db.prepare("SELECT nip, name, position FROM employees WHERE status = 'Aktif' ORDER BY name COLLATE NOCASE")
    .all() as KerjakuEmployee[];
}

export async function saveKerjakuRequest(input: {
  userId: string; nomorSurat: string; tanggalSurat: string; bulanDibuka: string;
  employees: KerjakuEmployee[]; document: Buffer;
}) {
  const id = randomUUID();
  const storageName = `${id}.docx`;
  const fileName = `Permohonan-Pembukaan-Kerjaku-${input.bulanDibuka}-${input.tanggalSurat}.docx`;
  const filePath = path.join(directory, storageName);
  const local = !isStorageConfigured();
  if (local) {
    await mkdir(directory, { recursive: true });
    await writeFile(filePath, input.document, { flag: "wx" });
  }
  try {
    await uploadStorageObject(storageName, input.document, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    await db.prepare(`INSERT INTO kerjaku_request_documents
      (id, user_id, nomor_surat, tanggal_surat, bulan_dibuka, employees_json,
       file_name, storage_name, file_size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, input.userId, input.nomorSurat, input.tanggalSurat, input.bulanDibuka,
        JSON.stringify(input.employees), fileName, storageName, input.document.length, new Date().toISOString());
  } catch (error) {
    if (local) await rm(filePath, { force: true });
    throw error;
  }
  return { id, fileName };
}

export type KerjakuRequestHistory = {
  id: string; nomorSurat: string; tanggalSurat: string; bulanDibuka: string;
  employeeCount: number; fileName: string; createdAt: string; createdBy: string;
};

export async function getKerjakuRequestHistory(): Promise<KerjakuRequestHistory[]> {
  const rows = await db.prepare(`SELECT d.id, d.nomor_surat, CAST(d.tanggal_surat AS TEXT) AS tanggal_surat, d.bulan_dibuka,
    d.employees_json, d.file_name, d.created_at, u.name AS created_by
    FROM kerjaku_request_documents AS d JOIN users AS u ON u.id = d.user_id
    ORDER BY d.created_at DESC`).all() as Array<{
      id: string; nomor_surat: string; tanggal_surat: string; bulan_dibuka: string;
      employees_json: string; file_name: string; created_at: string; created_by: string;
    }>;
  return rows.map((row) => ({
    id: row.id, nomorSurat: row.nomor_surat, tanggalSurat: row.tanggal_surat,
    bulanDibuka: row.bulan_dibuka, employeeCount: (JSON.parse(row.employees_json) as KerjakuEmployee[]).length,
    fileName: row.file_name, createdAt: row.created_at, createdBy: row.created_by,
  }));
}

export async function getKerjakuRequestDownload(id: string) {
  const row = await db.prepare("SELECT file_name, storage_name FROM kerjaku_request_documents WHERE id = ?")
    .get(id) as { file_name: string; storage_name: string } | undefined;
  if (!row || !namePattern.test(row.storage_name)) return null;
  return { fileName: row.file_name, storageName: row.storage_name, filePath: path.join(directory, row.storage_name) };
}
