import "server-only";
import path from "node:path";
import { database as db } from "@/lib/database";
import { downloadStorageObject } from "@/lib/storage";
import type { EmployeeDocument } from "@/lib/employee-documents";

const prefix = "kgb-";
export async function getEmployeeKgbDocuments(nip: string): Promise<EmployeeDocument[]> {
  const rows = await db.prepare(`SELECT s.id, s.document_id, s.document_revision, s.employee_nip, s.nomor_surat,
    CAST(s.tgl_surat AS TEXT) AS tgl_surat, CAST(s.tmt_kgb AS TEXT) AS tmt_kgb, s.file_name, s.file_size,
    CAST(s.created_at AS TEXT) AS created_at, COALESCE(u.name, 'Arsip KGB') AS created_by, d.revision AS current_revision
    FROM kgb_signed_documents s JOIN kgb_documents d ON d.id=s.document_id LEFT JOIN users u ON u.id=s.user_id
    WHERE s.employee_nip=? ORDER BY s.created_at DESC, s.id DESC`)
    .all<{ id: string; document_id: string; document_revision: number; employee_nip: string; nomor_surat: string | null; tgl_surat: string | null; tmt_kgb: string | null; file_name: string; file_size: number; created_at: string; created_by: string; current_revision: number }>(nip);
  return rows.map(r => ({ id: prefix + r.id, employeeNip: r.employee_nip, documentType: "sk_kgb", namaDokumen: `SK KGB Bertanda Tangan - Versi ${r.document_revision}`,
    nomorSurat: r.nomor_surat ?? "", tglSurat: r.tgl_surat ?? "", tmtSurat: r.tmt_kgb ?? "", masaKerja: null, tahun: null,
    penilaianKinerja: null, penilaianPerilaku: null, predikatSkp: null, fileName: r.file_name, fileSize: r.file_size, mimeType: "application/pdf",
    createdAt: r.created_at, createdBy: r.created_by, kgbSource: { documentId: r.document_id, signedId: r.id, revision: r.document_revision, currentWordVersion: r.document_revision === r.current_revision } }));
}

export async function getEmployeeKgbFile(nip: string, id: string) {
  const signedId = /^kgb-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(id)?.[1];
  if (!signedId) return null;
  const row = await db.prepare("SELECT file_name, storage_name, file_size FROM kgb_signed_documents WHERE id=? AND employee_nip=?")
    .get<{ file_name: string; storage_name: string; file_size: number }>(signedId, nip);
  if (!row || row.storage_name !== `${signedId}.pdf`) return null;
  return { fileName: row.file_name, fileSize: row.file_size, mimeType: "application/pdf", file: await downloadStorageObject(row.storage_name, path.join(process.cwd(), "data", "kgb-signed-documents", row.storage_name)) };
}
