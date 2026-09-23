import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { database as db } from "@/lib/database";
import type {
  EmployeeDocumentType,
  SkpAssessment,
  SkpPredicate,
} from "@/lib/employee-document-types";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";
import { downloadStorageObject } from "@/lib/storage";

const storageDirectory = path.join(process.cwd(), "data", "employee-documents");
const storageNamePattern = /^[0-9a-f-]{36}\.(pdf|doc|docx)$/i;
const mimeTypes = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;
const fileNamePrefixes: Record<EmployeeDocumentType, string> = {
  sk_cpns: "SK-CPNS",
  sk_pns_pertama: "SK-PNS-PERTAMA",
  sk_kontrak_pppk: "SK-KONTRAK-PPPK",
  dokumen_lainnya: "DOKUMEN-LAINNYA",
  sasaran_kinerja_pegawai: "SKP",
};

export const MAX_EMPLOYEE_DOCUMENT_SIZE = MAX_UPLOAD_SIZE_BYTES;

export type EmployeeDocument = {
  id: string;
  employeeNip: string;
  documentType: EmployeeDocumentType;
  nomorSurat: string;
  tglSurat: string;
  tmtSurat: string;
  masaKerja: string | null;
  tahun: number | null;
  penilaianKinerja: SkpAssessment | null;
  penilaianPerilaku: SkpAssessment | null;
  predikatSkp: SkpPredicate | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  createdBy: string;
};

type EmployeeDocumentRow = {
  id: string;
  employee_nip: string;
  document_type: EmployeeDocumentType;
  nomor_surat: string;
  tgl_surat: string | null;
  tmt_surat: string | null;
  masa_kerja: string | null;
  tahun: number | null;
  penilaian_kinerja: SkpAssessment | null;
  penilaian_perilaku: SkpAssessment | null;
  predikat_skp: SkpPredicate | null;
  original_file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  created_by: string;
};

function mapEmployeeDocument(row: EmployeeDocumentRow): EmployeeDocument {
  return {
    id: row.id,
    employeeNip: row.employee_nip,
    documentType: row.document_type,
    nomorSurat: row.nomor_surat,
    tglSurat: row.tgl_surat ?? "",
    tmtSurat: row.tmt_surat ?? "",
    masaKerja: row.masa_kerja,
    tahun: row.tahun,
    penilaianKinerja: row.penilaian_kinerja,
    penilaianPerilaku: row.penilaian_perilaku,
    predikatSkp: row.predikat_skp,
    fileName: row.original_file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

function fileExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return extension === ".pdf" || extension === ".doc" || extension === ".docx" ? extension : null;
}

function safeAutomaticFileNamePart(value: string, fallback: string) {
  const sanitized = value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 120);
  return sanitized || fallback;
}

function matchesFileSignature(extension: string, bytes: Buffer) {
  if (extension === ".pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (extension === ".docx") return bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (extension === ".doc") {
    const oleSignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    return oleSignature.every((value, index) => bytes[index] === value);
  }
  return false;
}

export function validateEmployeeDocumentFile(file: File, bytes: Buffer) {
  if (file.size === 0) return "File dokumen tidak boleh kosong.";
  if (file.size > MAX_EMPLOYEE_DOCUMENT_SIZE) return `Ukuran file maksimal ${MAX_UPLOAD_SIZE_MB} MB.`;
  const extension = fileExtension(file.name);
  if (!extension) return "Format file harus PDF, DOC, atau DOCX.";
  if (!matchesFileSignature(extension, bytes)) return "Isi file tidak sesuai dengan format PDF, DOC, atau DOCX yang dipilih.";
  return null;
}

export async function getEmployeeDocuments(employeeNip: string): Promise<EmployeeDocument[]> {
  const rows = await db.prepare(
    `SELECT
      documents.id,
      documents.employee_nip,
      documents.document_type,
      documents.nomor_surat,
      documents.tgl_surat,
      documents.tmt_surat,
      documents.masa_kerja,
      documents.tahun,
      documents.penilaian_kinerja,
      documents.penilaian_perilaku,
      documents.predikat_skp,
      documents.original_file_name,
      documents.file_size,
      documents.mime_type,
      documents.created_at,
      users.name AS created_by
     FROM employee_documents AS documents
     INNER JOIN users ON users.id = documents.user_id
     WHERE documents.employee_nip = ?
     ORDER BY documents.created_at DESC`,
  ).all(employeeNip) as EmployeeDocumentRow[];
  return rows.map(mapEmployeeDocument);
}

export async function saveEmployeeDocument({
  userId,
  employeeNip,
  documentType,
  nomorSurat,
  tglSurat,
  tmtSurat,
  masaKerja,
  tahun,
  penilaianKinerja,
  penilaianPerilaku,
  predikatSkp,
  file,
  bytes,
}: {
  userId: string;
  employeeNip: string;
  documentType: EmployeeDocumentType;
  nomorSurat: string;
  tglSurat: string;
  tmtSurat: string;
  masaKerja: string | null;
  tahun: number | null;
  penilaianKinerja: SkpAssessment | null;
  penilaianPerilaku: SkpAssessment | null;
  predikatSkp: SkpPredicate | null;
  file: File;
  bytes: Buffer;
}) {
  const id = randomUUID();
  const extension = fileExtension(file.name);
  if (!extension) throw new Error("Unsupported employee document extension");
  const storageName = `${id}${extension}`;
  const filePath = path.join(storageDirectory, storageName);
  const createdAt = new Date().toISOString();
  const automaticFileName = documentType === "dokumen_lainnya"
    ? `${safeAutomaticFileNamePart(nomorSurat, "Dokumen Lainnya")}_${safeAutomaticFileNamePart(employeeNip, "NIP")}${extension}`
    : documentType === "sasaran_kinerja_pegawai"
      ? `SKP-${tahun}_${safeAutomaticFileNamePart(employeeNip, "NIP")}${extension}`
      : `${fileNamePrefixes[documentType]}-${employeeNip}${extension}`;
  const mimeType = mimeTypes[extension];

  await mkdir(storageDirectory, { recursive: true });
  await writeFile(filePath, bytes, { flag: "wx" });
  try {
    await db.prepare(
      `INSERT INTO employee_documents (
        id, employee_nip, user_id, document_type, nomor_surat, tgl_surat,
        tmt_surat, masa_kerja, tahun, penilaian_kinerja, penilaian_perilaku,
        predikat_skp, original_file_name, storage_name, mime_type, file_size,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, employeeNip, userId, documentType, nomorSurat, tglSurat,
      tmtSurat, masaKerja, tahun, penilaianKinerja, penilaianPerilaku,
      predikatSkp, automaticFileName, storageName, mimeType, bytes.length,
      createdAt,
    );
  } catch (error) {
    await rm(filePath, { force: true });
    throw error;
  }

  return (await getEmployeeDocuments(employeeNip)).find((document) => document.id === id) ?? null;
}

export async function getEmployeeDocumentForDownload(employeeNip: string, id: string) {
  const row = await db.prepare(
    `SELECT original_file_name, storage_name, mime_type, file_size
     FROM employee_documents
     WHERE id = ? AND employee_nip = ?`,
  ).get(id, employeeNip) as {
    original_file_name: string;
    storage_name: string;
    mime_type: string;
    file_size: number;
  } | undefined;

  if (!row || !storageNamePattern.test(row.storage_name)) return null;
  return {
    fileName: row.original_file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    file: await downloadStorageObject(row.storage_name, path.join(storageDirectory, row.storage_name)),
  };
}

export async function getEmployeeDocumentsForArchive(employeeNip: string) {
  const rows = await db.prepare(
    `SELECT original_file_name, storage_name
     FROM employee_documents
     WHERE employee_nip = ?
     ORDER BY created_at DESC, id DESC`,
  ).all(employeeNip) as Array<{
    original_file_name: string;
    storage_name: string;
  }>;

  return Promise.all(rows.map(async (row) => {
    if (!storageNamePattern.test(row.storage_name)) {
      throw new Error("Invalid employee document storage name");
    }
    return {
      fileName: row.original_file_name,
      file: await downloadStorageObject(row.storage_name, path.join(storageDirectory, row.storage_name)),
    };
  }));
}

export async function deleteEmployeeDocument(employeeNip: string, id: string) {
  const row = await db.prepare(
    `SELECT document_type, original_file_name, storage_name
     FROM employee_documents
     WHERE id = ? AND employee_nip = ?`,
  ).get(id, employeeNip) as {
    document_type: EmployeeDocumentType;
    original_file_name: string;
    storage_name: string;
  } | undefined;

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
    const result = await db.prepare(
      "DELETE FROM employee_documents WHERE id = ? AND employee_nip = ?",
    ).run(id, employeeNip);
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
    documentType: row.document_type,
    fileName: row.original_file_name,
  };
}
