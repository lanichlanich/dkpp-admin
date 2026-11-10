import "server-only";
import { randomUUID } from "node:crypto";
import { database as db } from "@/lib/database";
import { disciplineCaseSchema, disciplineCaseStatus, emptyDisciplineCase, type DisciplineCase, type DisciplineEmployee } from "@/lib/discipline-case";

export class DisciplineCaseError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type CaseRow = {
  id: string;
  data_json: { employee: DisciplineEmployee; values: DisciplineCase["values"] } | string;
  revision: number;
};
export type DisciplineCaseSummary = { id: string; employee_name: string; employee_nip: string; reference: string; status: string; created_at: string | Date };
export function listDisciplineCases() {
  return db.prepare(`SELECT id, employee_name, employee_nip, reference, created_at,
    CASE WHEN status IN ('Upaya administratif', 'Tanggal berlaku tercatat', 'Keputusan diterima', 'Keputusan ditetapkan')
      THEN 'Hasil pemeriksaan tercatat' ELSE status END AS status
    FROM discipline_cases ORDER BY updated_at DESC, id DESC`).all<DisciplineCaseSummary>();
}

export function listDisciplineEmployees() {
  return db.prepare(`SELECT nip, name, rank, position, unit FROM employees
    WHERE asn_type = 'PNS' AND status = 'Aktif' ORDER BY name COLLATE NOCASE`).all<DisciplineEmployee>();
}

export async function getDisciplineCase(id: string): Promise<DisciplineCase | undefined> {
  const row = await db.prepare("SELECT id, data_json, revision FROM discipline_cases WHERE id = ?").get<CaseRow>(id);
  if (!row) return;
  const data = typeof row.data_json === "string" ? JSON.parse(row.data_json) : row.data_json;
  return { ...data, id: row.id, version: row.revision };
}

export async function saveDisciplineCase(userId: string, input: unknown, existing?: { id: string; version: number }): Promise<DisciplineCase> {
  const parsed = disciplineCaseSchema.safeParse(input);
  if (!parsed.success) throw new DisciplineCaseError(parsed.error.issues[0]?.message || "Periksa data perkara.", 422);
  const current = existing ? await getDisciplineCase(existing.id) : undefined;
  if (existing && !current) throw new DisciplineCaseError("Perkara tidak ditemukan.", 404);
  const values = { ...parsed.data,
    decision: current?.values.decision ?? emptyDisciplineCase.decision,
    authority: current?.values.authority ?? emptyDisciplineCase.authority,
  };
  const isLegacy = current && current.values.absenceDays === undefined;
  if (!isLegacy && values.absenceDays === undefined) throw new DisciplineCaseError("Masukkan jumlah hari kerja tidak masuk.", 422);
  if (isLegacy && (values.absenceDays !== undefined || !values.reference || !values.allegation))
    throw new DisciplineCaseError("Data dugaan dan nomor perkara lama harus tetap tersedia.", 422);
  if (current && current.employee.nip !== values.employeeNip) throw new DisciplineCaseError("Pegawai pada perkara yang sudah tersimpan tidak dapat diganti.", 409);
  if (current?.values.decision.issued && (current.values.absenceDays !== values.absenceDays ||
    Boolean(current.values.consecutiveAbsence) !== Boolean(values.consecutiveAbsence)))
    throw new DisciplineCaseError("Jumlah dan pola ketidakhadiran pada perkara yang sudah ditetapkan tidak dapat diubah.", 409);
  const employee = current?.employee ?? await db.prepare(`SELECT nip, name, rank, position, unit FROM employees
    WHERE nip = ? AND asn_type = 'PNS' AND status = 'Aktif'`).get<DisciplineEmployee>(values.employeeNip);
  if (!employee) throw new DisciplineCaseError("Pilih PNS aktif dari daftar pegawai.", 422);
  const id = current?.id ?? randomUUID();
  const referenceKey = isLegacy ? values.reference.normalize("NFKC").toLocaleLowerCase("id-ID").replace(/\s+/g, "") : `absence:${id}`;
  const data = JSON.stringify({ employee, values });
  const status = disciplineCaseStatus(values);
  const now = new Date().toISOString();
  try {
    const changed = existing
      ? await db.prepare(`UPDATE discipline_cases SET reference = ?, reference_key = ?, status = ?, data_json = ?,
          revision = revision + 1, updated_by = ?, updated_at = ? WHERE id = ? AND revision = ?`)
        .run(values.reference, referenceKey, status, data, userId, now, id, existing.version)
      : await db.prepare(`INSERT INTO discipline_cases (id, employee_nip, employee_name, reference, reference_key, status,
          data_json, revision, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`)
        .run(id, employee.nip, employee.name, values.reference, referenceKey, status, data, userId, now, now);
    if (!changed.changes) throw new DisciplineCaseError("Perkara sudah diperbarui. Muat ulang sebelum menyimpan.", 409);
  } catch (error) {
    if (isLegacy && ["23505", "SQLITE_CONSTRAINT_UNIQUE"].includes(String((error as { code?: string }).code))) {
      throw new DisciplineCaseError("Nomor register sudah dipakai.", 409);
    }
    throw error;
  }
  return { id, employee, values, version: (existing?.version ?? 0) + 1 };
}
