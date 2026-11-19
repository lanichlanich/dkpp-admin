import "server-only";
import { database } from "@/lib/database";
import { requireMenuAccess } from "@/lib/authorization";
import { jakartaToday } from "@/lib/plt-dates";
import { currentPositionMapStaff, defaultPositionMapPlan, positionMapPlanSchema, validMapYear, type PositionMapPlan, type PositionMapRecord } from "@/lib/position-map-model";
import type { ProjectionEmployee } from "@/lib/retirement-projection";
import { normalizePosition } from "@/lib/retirement-projection";
import { signatoryRank, signatorySchema, type Signatory } from "@/lib/signatory";

export class PositionMapError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
export async function getPositionMapHeadSignatory(): Promise<Signatory> {
  await requireMenuAccess("peta-jabatan");
  type Head = { nip: string; name: string; rank: string; position: string };
  const title = "KEPALA DINAS KETAHANAN PANGAN DAN PERTANIAN";
  const isHead = (value: string) => normalizePosition(value).replace(/^PLT /, "").replace(/ KAB(?:UPATEN)? INDRAMAYU$/, "") === title;
  const today = jakartaToday();
  const acting = await database.prepare(`SELECT e.nip, e.name, e.rank, p.acting_position AS position
    FROM plt_assignments p JOIN employees e ON e.nip = p.employee_nip
    WHERE e.status = 'Aktif' AND p.closed_at IS NULL AND p.start_date <= ? AND p.end_date >= ?
      AND NOT EXISTS (SELECT 1 FROM plt_assignments n WHERE n.previous_id = p.id AND n.start_date <= ?)`)
    .all<Head>(today, today, today);
  const activePlt = [...new Map(acting.filter(row => isHead(row.position)).map(row => [row.nip, row])).values()];
  const candidates = activePlt.length ? activePlt : (await database.prepare("SELECT nip, name, rank, position FROM employees WHERE status = 'Aktif'").all<Head>()).filter(row => isHead(row.position));
  if (candidates.length !== 1) throw new PositionMapError("Pastikan data kepala dinas atau penugasan Plt. kepala dinas aktif hanya menunjuk satu pejabat sebelum mengunduh A4.");
  const head = candidates[0];
  const parsed = signatorySchema.safeParse({ name: head.name, nip: head.nip, rank: signatoryRank(head.rank ?? "").full,
    title: `${title} KABUPATEN INDRAMAYU`, status: activePlt.length || /^plt\.?\s/i.test(head.position) ? "plt" : "definitif" });
  if (!parsed.success || !/^\d{18}$/.test(head.nip)) throw new PositionMapError("Lengkapi nama dan NIP kepala dinas pada data pegawai sebelum mengunduh A4.");
  return parsed.data;
}
export async function getPositionMapState(year: number) {
  await requireMenuAccess("peta-jabatan");
  if (!validMapYear(year)) throw new PositionMapError("Tahun harus antara 2000 dan 2099.");
  const employees = await database.prepare(`SELECT e.nip, e.name, e.position, e.position_type AS positionType,
    e.echelon, COALESCE(NULLIF(ou.name, ''), NULLIF(jp.unit, ''), e.unit) AS unit,
    e.asn_type AS asnType, e.rank, e.status FROM employees e
    LEFT JOIN job_positions jp ON jp.id = e.job_position_id
    LEFT JOIN organization_units ou ON ou.id = jp.organization_unit_id
    WHERE e.status = 'Aktif'`).all<ProjectionEmployee>();
  const today = jakartaToday(), staff = currentPositionMapStaff(employees, today);
  return { record: await getPositionMapPlan(year, staff.counts), staff, today };
}
export async function getPositionMapPlan(year: number, counts: Record<string, number>): Promise<PositionMapRecord> {
  if (!validMapYear(year)) throw new PositionMapError("Tahun tidak valid.");
  const row = await database.prepare(`SELECT CAST(data_json AS TEXT) AS dataJson, revision, CAST(updated_at AS TEXT) AS updatedAt FROM position_map_plans WHERE year = ?`)
    .get<{ dataJson: string; revision: number; updatedAt: string }>(year);
  if (!row) return { year, plan: defaultPositionMapPlan(counts), revision: 0, updatedAt: null };
  let value: unknown;
  try { value = JSON.parse(row.dataJson); } catch { throw new PositionMapError("Data peta jabatan tersimpan tidak dapat dibaca. Hubungi administrator.", 500); }
  const parsed = positionMapPlanSchema.safeParse(value);
  if (!parsed.success) throw new PositionMapError("Data tersimpan tidak sesuai katalog jabatan. Hubungi administrator sebelum menyimpan ulang.", 500);
  return { year, plan: parsed.data, revision: row.revision, updatedAt: row.updatedAt };
}
export async function savePositionMapPlan(year: number, input: unknown, revision: number, userId: string): Promise<PositionMapRecord> {
  if (!validMapYear(year) || !Number.isSafeInteger(revision) || revision < 0) throw new PositionMapError("Tahun atau versi data tidak valid.");
  const parsed = positionMapPlanSchema.safeParse(input);
  if (!parsed.success) throw new PositionMapError(parsed.error.issues[0]?.message ?? "Periksa isian peta jabatan.");
  const data: PositionMapPlan = parsed.data, now = new Date().toISOString();
  const result = revision === 0
    ? await database.prepare(`INSERT INTO position_map_plans (year, data_json, revision, updated_by, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?, ?) ON CONFLICT (year) DO NOTHING`).run(year, JSON.stringify(data), userId, now, now)
    : await database.prepare(`UPDATE position_map_plans SET data_json = ?, revision = revision + 1, updated_by = ?, updated_at = ?
      WHERE year = ? AND revision = ?`).run(JSON.stringify(data), userId, now, year, revision);
  if (!result.changes) throw new PositionMapError("Peta jabatan telah disimpan pengguna lain. Muat ulang halaman sebelum menyimpan perubahan Anda.", 409);
  return { year, plan: data, revision: revision + 1, updatedAt: now };
}
