import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";
import { isStorageConfigured, uploadStorageObject } from "@/lib/storage";
import { calculatePak, periodLabel } from "@/lib/pak";
import type { PakInput } from "@/lib/pak-validation";

const directory = path.join(process.cwd(), "data", "pak-documents");
export type PakDocumentHistory = { id: string; employeeNip: string; employeeName: string; employeeStatus: string; nomor: string; tanggal: string; period: string; total: number; fileName: string; createdAt: string; createdBy: string };
export async function savePakDocument(userId: string, employee: { name: string; status: string }, input: PakInput, document: Buffer) {
  const id = randomUUID();
  const storageName = `${id}.docx`;
  const fileName = `PAK-${input.nip}-${input.period.year}-${id.slice(0, 8)}.docx`;
  const filePath = path.join(directory, storageName);
  const localStorageEnabled = !isStorageConfigured();
  if (localStorageEnabled) {
    await mkdir(directory, { recursive: true });
    await writeFile(filePath, document, { flag: "wx" });
  }
  try {
    await uploadStorageObject(storageName, document, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    await db.prepare(`INSERT INTO pak_documents (id, user_id, employee_nip, employee_name, employee_status, nomor, tanggal, period, total, input_json, file_name, storage_name, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, userId, input.nip, employee.name, employee.status, input.nomor, input.tanggal, `${periodLabel(input.period)} ${input.period.year}`, calculatePak(input).total, JSON.stringify({ ...input, employeeName: employee.name, employeeStatus: employee.status }), fileName, storageName, document.length, new Date().toISOString());
  } catch (error) { if (localStorageEnabled) await rm(filePath, { force: true }); throw error; }
  return { id, fileName };
}
export async function getPakHistory(): Promise<PakDocumentHistory[]> {
  await requireUser();
  return await db.prepare(`SELECT d.id, d.employee_nip AS employeeNip, d.employee_name AS employeeName, d.employee_status AS employeeStatus, d.nomor, d.tanggal, d.period, d.total, d.file_name AS fileName, d.created_at AS createdAt, u.name AS createdBy FROM pak_documents d JOIN users u ON u.id = d.user_id ORDER BY d.created_at DESC`).all() as PakDocumentHistory[];
}
export async function getPakDocumentForDownload(id: string) {
  const row = await db.prepare("SELECT file_name, storage_name FROM pak_documents WHERE id = ?").get(id) as { file_name: string; storage_name: string } | undefined;
  if (!row || !/^[0-9a-f-]{36}\.docx$/i.test(row.storage_name)) return null;
  return { fileName: row.file_name, storageName: row.storage_name, filePath: path.join(directory, row.storage_name) };
}
