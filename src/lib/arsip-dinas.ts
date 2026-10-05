import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { database as db } from "@/lib/database";
import { isStorageConfigured, uploadStorageObject } from "@/lib/storage";

export const archiveMetadataSchema = z.object({
  namaDokumen: z.string().trim().min(1, "Nama dokumen wajib diisi.").max(180).regex(/^[^\r\n<>]+$/, "Nama dokumen tidak valid."),
  nomor: z.string().trim().max(120).regex(/^[^\r\n<>]*$/, "Nomor dokumen tidak valid.").default(""),
  jenisDokumen: z.string().trim().min(1, "Jenis dokumen wajib diisi.").max(100).regex(/^[^\r\n<>]+$/, "Jenis dokumen tidak valid."),
  tglDokumen: z.iso.date(),
});

const localDirectory = path.join(process.cwd(), "data", "service-archive");
const storagePattern = /^[0-9a-f-]{36}\.pdf$/i;
const selectColumns = `id, nama_dokumen, nomor, jenis_dokumen, CAST(tgl_dokumen AS TEXT) AS tgl_dokumen,
  file_name, file_size, created_at, updated_at`;

export type ArchiveDocument = {
  id: string; namaDokumen: string; nomor: string; jenisDokumen: string; tglDokumen: string;
  fileName: string; fileSize: number; createdAt: string; updatedAt: string;
};

type ArchiveRow = {
  id: string; nama_dokumen: string; nomor: string; jenis_dokumen: string; tgl_dokumen: string;
  file_name: string; file_size: number; created_at: string; updated_at: string;
};

function mapRow(row: ArchiveRow): ArchiveDocument {
  return { id: row.id, namaDokumen: row.nama_dokumen, nomor: row.nomor, jenisDokumen: row.jenis_dokumen,
    tglDokumen: row.tgl_dokumen.slice(0, 10), fileName: row.file_name, fileSize: row.file_size,
    createdAt: row.created_at, updatedAt: row.updated_at };
}

function safeFileName(name: string) {
  const stem = name.normalize("NFKC").replace(/[\\/\x00-\x1f<>:"|?*]/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/g, "").slice(0, 150);
  return `${stem || "Dokumen"}.pdf`;
}

export async function listArchiveDocuments(): Promise<ArchiveDocument[]> {
  const rows = await db.prepare(`SELECT ${selectColumns} FROM service_archive_documents ORDER BY tgl_dokumen DESC, created_at DESC`)
    .all() as ArchiveRow[];
  return rows.map(mapRow);
}

export async function saveArchiveDocument(input: { userId: string; metadata: z.infer<typeof archiveMetadataSchema>; file: Buffer }) {
  const id = randomUUID();
  const storageName = `${id}.pdf`;
  const fileName = safeFileName(input.metadata.namaDokumen);
  const local = !isStorageConfigured();
  const filePath = path.join(localDirectory, storageName);
  if (local) {
    await mkdir(localDirectory, { recursive: true });
    await writeFile(filePath, input.file, { flag: "wx" });
  }
  const now = new Date().toISOString();
  try {
    await uploadStorageObject(`service-archive/${storageName}`, input.file, "application/pdf");
    await db.prepare(`INSERT INTO service_archive_documents
      (id, user_id, nama_dokumen, nomor, jenis_dokumen, tgl_dokumen, file_name, storage_name, file_size, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, input.userId, input.metadata.namaDokumen, input.metadata.nomor, input.metadata.jenisDokumen,
        input.metadata.tglDokumen, fileName, `service-archive/${storageName}`, input.file.length, now, now);
  } catch (error) {
    if (local) await rm(filePath, { force: true });
    throw error;
  }
  const row = await db.prepare(`SELECT ${selectColumns} FROM service_archive_documents WHERE id = ?`).get(id) as ArchiveRow;
  return mapRow(row);
}

export async function updateArchiveDocument(id: string, metadata: z.infer<typeof archiveMetadataSchema>) {
  const existing = await db.prepare("SELECT id FROM service_archive_documents WHERE id = ?").get(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  await db.prepare(`UPDATE service_archive_documents SET nama_dokumen = ?, nomor = ?, jenis_dokumen = ?, tgl_dokumen = ?, file_name = ?, updated_at = ? WHERE id = ?`)
    .run(metadata.namaDokumen, metadata.nomor, metadata.jenisDokumen, metadata.tglDokumen, safeFileName(metadata.namaDokumen), now, id);
  const row = await db.prepare(`SELECT ${selectColumns} FROM service_archive_documents WHERE id = ?`).get(id) as ArchiveRow;
  return mapRow(row);
}

export async function getArchiveDownload(id: string) {
  const row = await db.prepare("SELECT file_name, storage_name FROM service_archive_documents WHERE id = ?").get(id) as { file_name: string; storage_name: string } | undefined;
  if (!row || !/^service-archive\/[0-9a-f-]{36}\.pdf$/i.test(row.storage_name) || !storagePattern.test(path.posix.basename(row.storage_name))) return null;
  return { fileName: row.file_name, storageName: row.storage_name, filePath: path.join(localDirectory, path.posix.basename(row.storage_name)) };
}
