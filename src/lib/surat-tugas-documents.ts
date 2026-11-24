import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { database } from "@/lib/database";
import type { SuratTugasInput } from "@/lib/surat-tugas-validation";

export const suratTugasDirectory = "surat-tugas-documents";
const storageDirectory = () => path.join(process.cwd(), "data", suratTugasDirectory);
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type Actor = { id: string; isAdministrator: boolean };
export type SuratTugasHistoryItem = {
  id: string; userId: string | null; createdBy: string; nomorSurat: string; tanggalSurat: string;
  penugasan: string; recipientCount: number; createdAt: string;
};

export async function saveSuratTugasDocument(user: { id: string; name: string }, input: SuratTugasInput, file: Buffer) {
  const id = randomUUID();
  const storageName = `${id}.docx`;
  const fileName = `Surat-Tugas-${input.tanggal}.docx`;
  const directory = storageDirectory();
  const filePath = path.join(directory, storageName);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  // Open exclusively so cleanup can never remove a pre-existing archive.
  await writeFile(filePath, file, { flag: "wx", mode: 0o600 });
  try {
    await database.prepare(`INSERT INTO surat_tugas_documents
      (id, user_id, created_by, nomor_surat, tanggal_surat, penugasan, recipient_count, file_name, storage_name, file_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, user.id, user.name, input.nomor, input.tanggal, input.tugas[0], input.employeeNips.length, fileName, storageName, file.length, new Date().toISOString());
  } catch (error) {
    await rm(filePath, { force: true });
    throw error;
  }
  return { id, fileName };
}

export function listSuratTugasDocuments() {
  return database.prepare(`SELECT id, user_id AS userId, created_by AS createdBy, nomor_surat AS nomorSurat,
    CAST(tanggal_surat AS TEXT) AS tanggalSurat, penugasan, recipient_count AS recipientCount, created_at AS createdAt
    FROM surat_tugas_documents ORDER BY created_at DESC, id DESC`).all<SuratTugasHistoryItem>();
}

export async function readSuratTugasArchiveFile(storageName: string) {
  if (!storageName.endsWith(".docx") || !idPattern.test(storageName.slice(0, -5))) throw new Error("Nama berkas Surat Tugas tidak sah.");
  return readFile(path.join(storageDirectory(), storageName));
}

export async function getSuratTugasDownload(id: string) {
  if (!idPattern.test(id)) return null;
  const row = await database.prepare("SELECT CAST(tanggal_surat AS TEXT) AS tanggal_surat, storage_name, file_size FROM surat_tugas_documents WHERE id = ?")
    .get<{ tanggal_surat: string; storage_name: string; file_size: number }>(id);
  if (!row || row.storage_name !== `${id}.docx` || !/^\d{4}-\d{2}-\d{2}$/.test(row.tanggal_surat)) return null;
  try {
    const file = await readSuratTugasArchiveFile(row.storage_name);
    if (file.length !== row.file_size) return null;
    return suratTugasDownloadResponse(file, { id, fileName: `Surat-Tugas-${row.tanggal_surat}.docx` });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function suratTugasDownloadResponse(file: Buffer, document: { id: string; fileName: string }) {
  return new Response(new Uint8Array(file), { headers: {
    "Content-Type": mimeType, "Content-Disposition": `attachment; filename="${document.fileName}"`,
    "Content-Length": String(file.length), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Document-Id": document.id,
  } });
}

export async function deleteSuratTugasDocument(id: string, actor: Actor) {
  if (!idPattern.test(id)) return "missing";
  const row = await database.prepare("SELECT user_id FROM surat_tugas_documents WHERE id = ?").get<{ user_id: string | null }>(id);
  if (!row) return "missing";
  if (!actor.isAdministrator && row.user_id !== actor.id) return "forbidden";
  const deleted = actor.isAdministrator
    ? await database.prepare("DELETE FROM surat_tugas_documents WHERE id = ?").run(id)
    : await database.prepare("DELETE FROM surat_tugas_documents WHERE id = ? AND user_id = ?").run(id, actor.id);
  if (!deleted.changes) return "missing";
  // Revoke access first, then remove the private bytes. Never restore a deleted row on cleanup failure.
  await rm(path.join(storageDirectory(), `${id}.docx`), { force: true }).catch(error => console.error("Pembersihan arsip Surat Tugas gagal", id, error));
  return "deleted";
}
