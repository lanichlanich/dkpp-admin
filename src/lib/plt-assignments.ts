import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { database as db } from "@/lib/database";
import { requireMenuAccess } from "@/lib/authorization";
import { nextPltDay, pltEndDate, pltSchema, type PltAssignment, type PltEmployee } from "@/lib/plt-dates";
import { removePltFile, storePltFile, type PltDocument } from "@/lib/plt-files";

export class PltError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const select = `SELECT p.id, p.employee_nip AS employeeNip, p.employee_name AS employeeName,
  p.acting_position AS actingPosition, p.acting_unit AS actingUnit, p.sk_number AS skNumber,
  CAST(p.start_date AS TEXT) AS startDate, CAST(p.end_date AS TEXT) AS endDate,
  p.notes, p.closed_at AS closedAt, p.previous_id AS previousId, p.file_name AS fileName, p.file_size AS fileSize,
  EXISTS(SELECT 1 FROM plt_assignments successor WHERE successor.previous_id = p.id) AS hasNext
  FROM plt_assignments p`;

export async function getPltAssignments(): Promise<PltAssignment[]> {
  await requireMenuAccess("daftar-plt");
  const rows = await db.prepare(`${select} ORDER BY p.end_date, p.employee_name`).all<PltAssignment>();
  return rows.map(row => ({ ...row, hasNext: Boolean(row.hasNext) }));
}
export async function getPltEmployees() {
  await requireMenuAccess("daftar-plt");
  return db.prepare("SELECT nip, name, position, unit FROM employees WHERE status = 'Aktif' ORDER BY name COLLATE NOCASE").all<PltEmployee>();
}
async function getAssignment(id: string) {
  const row = await db.prepare(`${select} WHERE p.id = ?`).get<PltAssignment>(id);
  if (!row) throw new PltError("Penugasan Plt. tidak ditemukan.", 404);
  return row;
}
function refresh() {
  revalidatePath("/dashboard/daftar-plt");
  revalidatePath("/dashboard");
}

export async function getPltDocument(id: string) {
  await requireMenuAccess("daftar-plt");
  return db.prepare(`SELECT file_name AS fileName, storage_name AS storageName, file_size AS fileSize, mime_type AS mimeType
    FROM plt_assignments WHERE id = ? AND storage_name IS NOT NULL`).get<PltDocument>(id);
}

export async function savePltAssignment(input: unknown, id?: string, file?: File) {
  const user = await requireMenuAccess("daftar-plt");
  const data = pltSchema.parse(input);
  const existing = id ? await getAssignment(id) : null;
  if (existing?.hasNext) throw new PltError("Periode ini sudah diperpanjang. Edit periode terakhir agar riwayat tetap konsisten.", 409);
  if (existing && (data.previousId || null) !== (existing.previousId || null))
    throw new PltError("Hubungan riwayat perpanjangan tidak dapat diubah.");
  const employee = await db.prepare("SELECT nip, name, status FROM employees WHERE nip = ?").get<{ nip: string; name: string; status: string }>(data.employeeNip);
  if (!employee || (employee.status !== "Aktif" && existing?.employeeNip !== employee.nip)) throw new PltError("Pegawai tidak tersedia atau sudah tidak aktif.");
  const previousId = existing?.previousId || data.previousId || null;
  if (previousId) {
    const previous = await getAssignment(previousId);
    if (previous.closedAt || (!id && previous.hasNext)) throw new PltError("Penugasan ini sudah selesai atau sudah diperpanjang.", 409);
    if (previous.employeeNip !== data.employeeNip || previous.actingPosition !== data.actingPosition || previous.actingUnit !== data.actingUnit || nextPltDay(previous.endDate) !== data.startDate)
      throw new PltError("Perpanjangan harus melanjutkan pegawai, jabatan, unit, dan hari setelah periode sebelumnya.");
  }
  const endDate = pltEndDate(data.startDate);
  const oldDocument = id ? await getPltDocument(id) : undefined;
  if (!file && !oldDocument) throw new PltError("Unggah dokumen SK Plt. untuk periode ini.");
  const now = new Date().toISOString();
  const assignmentId = id || randomUUID();
  // Check overlaps in the mutation itself, including different holders of the same post.
  const overlap = `NOT EXISTS (SELECT 1 FROM plt_assignments successor WHERE successor.previous_id = ?)
    AND NOT EXISTS (SELECT 1 FROM plt_assignments other WHERE other.id <> ?
    AND lower(other.acting_position) = lower(?) AND lower(other.acting_unit) = lower(?)
    AND other.closed_at IS NULL AND other.start_date <= ? AND other.end_date >= ?)`;
  const overlapValues = [assignmentId, assignmentId, data.actingPosition, data.actingUnit, endDate, data.startDate];
  const uploaded = file ? await storePltFile(file) : undefined;
  const document = (uploaded ?? oldDocument)!;
  try {
    const result = existing
      ? await db.prepare(`UPDATE plt_assignments SET employee_nip = ?, employee_name = ?, acting_position = ?, acting_unit = ?,
        sk_number = ?, start_date = ?, end_date = ?, notes = ?, updated_at = ?, file_name = ?, storage_name = ?, file_size = ?, mime_type = ?
        WHERE id = ? AND COALESCE(storage_name, '') = ? AND ${overlap}`)
        .run(data.employeeNip, employee.name, data.actingPosition, data.actingUnit, data.skNumber, data.startDate, endDate, data.notes, now,
          document.fileName, document.storageName, document.fileSize, document.mimeType, assignmentId, oldDocument?.storageName ?? "", ...overlapValues)
      : await db.prepare(`INSERT INTO plt_assignments (id, employee_nip, employee_name, acting_position, acting_unit,
        sk_number, start_date, end_date, notes, previous_id, created_by, created_at, updated_at, file_name, storage_name, file_size, mime_type)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${overlap}`)
        .run(assignmentId, data.employeeNip, employee.name, data.actingPosition, data.actingUnit, data.skNumber, data.startDate, endDate, data.notes, previousId, user.id, now, now,
          document.fileName, document.storageName, document.fileSize, document.mimeType, ...overlapValues);
    if (!result.changes) throw new PltError("Jabatan dan unit tersebut sudah memiliki penugasan pada periode yang bertumpang tindih.", 409);
  } catch (error) {
    if (uploaded) await removePltFile(uploaded).catch(cleanupError => console.error("Rollback file SK Plt. gagal", cleanupError));
    if (error instanceof PltError) throw error;
    if (error && typeof error === "object" && "code" in error && /23505|SQLITE_CONSTRAINT/.test(String(error.code)))
      throw new PltError("Periode atau perpanjangan tersebut sudah tersimpan. Muat ulang daftar.", 409);
    throw error;
  }
  if (uploaded && oldDocument) await removePltFile(oldDocument).catch(error => console.error("Pembersihan file SK Plt. lama gagal", error));
  refresh();
  return assignmentId;
}

export async function closePltAssignment(id: string) {
  await requireMenuAccess("daftar-plt");
  await getAssignment(id);
  const now = new Date().toISOString();
  await db.prepare("UPDATE plt_assignments SET closed_at = ?, updated_at = ? WHERE id = ? AND closed_at IS NULL").run(now, now, id);
  refresh();
}
export async function deletePltAssignment(id: string) {
  await requireMenuAccess("daftar-plt");
  const row = await getAssignment(id);
  if (row.hasNext) throw new PltError("Hapus periode lanjutan terlebih dahulu agar riwayat tidak terputus.", 409);
  const document = await getPltDocument(id);
  const result = await db.prepare("DELETE FROM plt_assignments WHERE id = ? AND COALESCE(storage_name, '') = ?").run(id, document?.storageName ?? "");
  if (!result.changes) throw new PltError("Penugasan baru saja berubah. Muat ulang daftar terlebih dahulu.", 409);
  if (document) await removePltFile(document).catch(error => console.error("Pembersihan SK Plt. terhapus gagal", error));
  refresh();
}
