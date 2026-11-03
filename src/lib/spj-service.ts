import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { database as db } from "@/lib/database";
import { requireMenuAccess } from "@/lib/authorization";
import { jakartaToday } from "@/lib/plt-dates";
import { spjCalendar } from "@/lib/spj-calendar";
import { spjDeleteSchema, spjReportSchema, spjTypeSchema, spjVersionSchema, spjWorkerSchema, type SpjEmployee, type SpjOptions, type SpjReport, type SpjSnapshot, type SpjType, type SpjWorker } from "@/lib/spj-types";

export class SpjError extends Error { constructor(message: string, public status = 400) { super(message); } }
const menu = "spj-pelayanan-umum";
const typeSelect = "SELECT id,name,day_mode AS dayMode,active_days AS activeDays,daily_rate AS dailyRate,weekdays_json AS weekdaysJson,updated_at AS updatedAt FROM spj_service_types";
type TypeRow = Omit<SpjType, "weekdays"> & { weekdaysJson: string };
const mapType = ({ weekdaysJson, ...row }: TypeRow): SpjType => ({ ...row, weekdays: JSON.parse(weekdaysJson) });
const workerSelect = "SELECT id,type_id AS typeId,name,bank,account_number AS accountNumber,is_active AS isActive,updated_at AS updatedAt FROM spj_service_workers";
const reportSelect = "SELECT id,type_name AS typeName,period,active_count AS activeCount,worker_count AS workerCount,total,created_at AS createdAt FROM spj_service_reports";
function refresh() { revalidatePath(`/dashboard/${menu}`); }
function changed(): never { throw new SpjError("Data telah berubah atau dihapus. Muat ulang halaman sebelum melanjutkan.", 409); }
const nextStamp = (previous?: string) => new Date(Math.max(Date.now(), (Date.parse(previous ?? "") || 0) + 1)).toISOString();
const mapWorker = (row: Omit<SpjWorker, "isActive"> & { isActive: number }): SpjWorker => ({ ...row, isActive: Boolean(row.isActive) });

export async function getSpjOptions(): Promise<SpjOptions> {
  await requireMenuAccess(menu);
  const today = jakartaToday();
  const [types, workers, employees, actingHeads, reports] = await Promise.all([
    db.prepare(`${typeSelect} ORDER BY name COLLATE NOCASE`).all<TypeRow>(),
    db.prepare(`${workerSelect} ORDER BY name COLLATE NOCASE`).all<Omit<SpjWorker, "isActive"> & { isActive: number }>(),
    db.prepare("SELECT nip,name,position FROM employees WHERE status='Aktif' ORDER BY name COLLATE NOCASE").all<SpjEmployee>(),
    db.prepare(`SELECT employee_nip AS nip FROM plt_assignments WHERE lower(acting_position) LIKE '%kepala dinas%' AND closed_at IS NULL AND start_date <= ? AND end_date >= ? ORDER BY start_date DESC`).all<{ nip: string }>(today, today),
    db.prepare(`${reportSelect} ORDER BY created_at DESC LIMIT 100`).all<SpjReport>(),
  ]);
  const actingHead = actingHeads.map(row => employees.find(e => e.nip === row.nip)).find(Boolean);
  const head = actingHead ?? employees.find(e => /kepala dinas/i.test(e.position)) ?? employees.find(e => /rory\s+firmansyah/i.test(e.name));
  return { types: types.map(mapType), workers: workers.map(mapWorker), employees, reports,
    defaults: { paNip: head?.nip ?? "", paStatus: actingHead ? "plt" : "definitif",
      pptkNip: employees.find(e => /^sekretaris\s+dinas/i.test(e.position))?.nip ?? "",
      treasurerNip: employees.find(e => /naj[ae]rudin\s+lutfi/i.test(e.name))?.nip ?? "" } };
}
export async function saveSpjType(input: unknown, id?: string) {
  await requireMenuAccess(menu);
  const d = spjTypeSchema.parse(input), previous = id ? spjVersionSchema.parse(input).updatedAt : undefined;
  const now = nextStamp(previous), key = id ?? randomUUID();
  const values = [d.name, d.dayMode, d.activeDays, d.dailyRate, JSON.stringify(d.weekdays), now];
  const result = id
    ? await db.prepare("UPDATE spj_service_types SET name=?,day_mode=?,active_days=?,daily_rate=?,weekdays_json=?,updated_at=? WHERE id=? AND updated_at=?").run(...values, id, spjVersionSchema.parse(input).updatedAt)
    : await db.prepare("INSERT INTO spj_service_types(name,day_mode,active_days,daily_rate,weekdays_json,updated_at,id,created_at) VALUES(?,?,?,?,?,?,?,?)").run(...values, key, now);
  if (!result.changes) changed(); refresh(); return key;
}
export async function saveSpjWorker(input: unknown, id?: string) {
  await requireMenuAccess(menu);
  const d = spjWorkerSchema.parse(input), previous = id ? spjVersionSchema.parse(input).updatedAt : undefined;
  const now = nextStamp(previous), key = id ?? randomUUID();
  if (!await db.prepare("SELECT id FROM spj_service_types WHERE id=?").get(d.typeId)) throw new SpjError("Jenis tenaga tidak ditemukan.", 404);
  const values = [d.typeId, d.name, d.bank, d.accountNumber, Number(d.isActive), now];
  const result = id
    ? await db.prepare("UPDATE spj_service_workers SET type_id=?,name=?,bank=?,account_number=?,is_active=?,updated_at=? WHERE id=? AND updated_at=?").run(...values, id, spjVersionSchema.parse(input).updatedAt)
    : await db.prepare("INSERT INTO spj_service_workers(type_id,name,bank,account_number,is_active,updated_at,id,created_at) VALUES(?,?,?,?,?,?,?,?)").run(...values, key, now);
  if (!result.changes) changed(); refresh(); return key;
}
export async function deleteSpjItem(resource: string, id: string, input: unknown) {
  await requireMenuAccess(menu);
  const d = spjDeleteSchema.parse(input);
  let result;
  if (resource === "types") {
    result = await db.prepare("DELETE FROM spj_service_types WHERE id=? AND updated_at=? AND NOT EXISTS(SELECT 1 FROM spj_service_workers WHERE type_id=?)").run(id, d.updatedAt, id);
    if (!result.changes) throw new SpjError("Jenis tenaga berubah atau masih memiliki petugas. Pindahkan/hapus petugasnya terlebih dahulu.", 409);
  } else if (resource === "workers") result = await db.prepare("DELETE FROM spj_service_workers WHERE id=? AND updated_at=?").run(id, d.updatedAt);
  else if (resource === "reports") result = await db.prepare("DELETE FROM spj_service_reports WHERE id=? AND created_at=?").run(id, d.updatedAt);
  else throw new SpjError("Menu tidak ditemukan.", 404);
  if (!result.changes) changed(); refresh();
}
export async function createSpjReport(input: unknown) {
  const user = await requireMenuAccess(menu), d = spjReportSchema.parse(input);
  const prior = await db.prepare("SELECT id FROM spj_service_reports WHERE id=?").get<{ id: string }>(d.requestId);
  if (prior) return prior.id;
  const typeRow = await db.prepare(`${typeSelect} WHERE id=?`).get<TypeRow>(d.typeId);
  if (!typeRow || typeRow.updatedAt !== d.typeUpdatedAt) changed();
  const type = mapType(typeRow);
  const rows = await db.prepare(`${workerSelect} WHERE type_id=? AND is_active=1 ORDER BY name COLLATE NOCASE`).all<Omit<SpjWorker, "isActive"> & { isActive: number }>(d.typeId);
  if (!rows.length) throw new SpjError("Tambahkan minimal satu petugas aktif untuk jenis tenaga ini.");
  if (rows.length > 500) throw new SpjError("Maksimal 500 petugas untuk satu SPJ.");
  const supplied = new Map(d.workers.map(w => [w.id, w.updatedAt]));
  if (supplied.size !== d.workers.length || supplied.size !== rows.length || rows.some(w => supplied.get(w.id) !== w.updatedAt)) changed();
  const employees = await db.prepare("SELECT nip,name,position FROM employees WHERE status='Aktif' AND nip IN (?,?,?)").all<SpjEmployee>(d.paNip, d.pptkNip, d.treasurerNip);
  const resolve = (nip: string) => { const employee = employees.find(e => e.nip === nip); if (!employee) throw new SpjError("Penandatangan harus dipilih dari pegawai aktif yang terdaftar."); return employee; };
  let days;
  try { days = spjCalendar(d.period, type, d.seed); } catch (error) { throw new SpjError((error as Error).message); }
  const activeCount = days.filter(day => day.state === "active").length;
  if (!activeCount) throw new SpjError("Tidak ada hari aktif dalam periode ini.");
  const snapshot: SpjSnapshot = { version: 1, period: d.period, typeName: type.name,
    rule: { dayMode: type.dayMode, activeDays: type.activeDays, weekdays: type.weekdays }, seed: d.seed,
    documentDate: d.documentDate, days, workers: rows.map(({ id, name, bank, accountNumber }) => ({ id, name, bank, accountNumber })),
    dailyRate: type.dailyRate, activeCount, total: activeCount * type.dailyRate * rows.length,
    signers: { pa: { ...resolve(d.paNip), status: d.paStatus }, pptk: resolve(d.pptkNip), treasurer: resolve(d.treasurerNip) } };
  // Recheck master versions in the INSERT so a concurrent edit cannot save a stale preview.
  const workerChecks = rows.map(() => "(id=? AND updated_at=?)").join(" OR ");
  const result = await db.prepare(`INSERT INTO spj_service_reports(id,type_id,type_name,period,snapshot_json,active_count,worker_count,total,created_by,created_at)
    SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM spj_service_types WHERE id=? AND updated_at=?)
    AND (SELECT COUNT(*) FROM spj_service_workers WHERE type_id=? AND is_active=1)=?
    AND (SELECT COUNT(*) FROM spj_service_workers WHERE type_id=? AND is_active=1 AND (${workerChecks}))=?`)
    .run(d.requestId, type.id, type.name, d.period, JSON.stringify(snapshot), activeCount, rows.length, snapshot.total, user.id, new Date().toISOString(),
      type.id, type.updatedAt, type.id, rows.length, type.id, ...rows.flatMap(w => [w.id, w.updatedAt]), rows.length);
  if (!result.changes) changed(); refresh(); return d.requestId;
}
export async function getSpjReport(id: string) {
  await requireMenuAccess(menu);
  const row = await db.prepare("SELECT snapshot_json AS snapshotJson FROM spj_service_reports WHERE id=?").get<{ snapshotJson: string }>(id);
  if (!row) throw new SpjError("SPJ tidak ditemukan.", 404);
  const snapshot = JSON.parse(row.snapshotJson) as SpjSnapshot;
  if (snapshot.version !== 1) throw new SpjError("Versi dokumen tidak didukung.", 409);
  return snapshot;
}
