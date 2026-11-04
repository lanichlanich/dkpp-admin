import "server-only";
import { database as db } from "@/lib/database";
import { createAnjabPlanSchema, defaultAnjabPlan, validAnjabYear, type AnjabPlan } from "@/lib/anjab-abk-calculation";
import { anjabCatalog } from "@/lib/anjab-abk-source";
const anjabPlanSchema = createAnjabPlanSchema(anjabCatalog);

export class AnjabError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
export type AnjabPlanRecord = { year: number; plan: AnjabPlan; revision: number; updatedAt: string | null };
export async function getAnjabPlan(year: number): Promise<AnjabPlanRecord> {
  if (!validAnjabYear(year)) throw new AnjabError("Tahun harus antara 2000 dan 2099.", 400);
  const row = await db.prepare(`SELECT CAST(data_json AS TEXT) AS dataJson, revision, CAST(updated_at AS TEXT) AS updatedAt FROM anjab_abk_plans WHERE year = ?`)
    .get<{ dataJson: string; revision: number; updatedAt: string }>(year);
  if (!row) return { year, plan: defaultAnjabPlan(anjabCatalog), revision: 0, updatedAt: null };
  const parsed = anjabPlanSchema.safeParse(JSON.parse(row.dataJson));
  if (!parsed.success) throw new AnjabError("Data Anjab-ABK tersimpan tidak sesuai katalog. Hubungi administrator sebelum menyimpan ulang.", 500);
  return { year, plan: parsed.data, revision: row.revision, updatedAt: row.updatedAt };
}
export async function saveAnjabPlan(year: number, plan: AnjabPlan, revision: number, userId: string) {
  if (!validAnjabYear(year)) throw new AnjabError("Tahun tidak valid.", 400);
  if (!Number.isSafeInteger(revision) || revision < 0) throw new AnjabError("Versi data tidak valid.", 400);
  const parsed = anjabPlanSchema.safeParse(plan);
  if (!parsed.success) throw new AnjabError(parsed.error.issues[0]?.message ?? "Periksa isian Anjab-ABK.");
  const data = JSON.stringify(parsed.data), now = new Date().toISOString();
  const result = revision === 0
    ? await db.prepare(`INSERT INTO anjab_abk_plans (year, data_json, revision, updated_by, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?) ON CONFLICT (year) DO NOTHING`).run(year, data, userId, now, now)
    : await db.prepare(`UPDATE anjab_abk_plans SET data_json = ?, revision = revision + 1, updated_by = ?, updated_at = ? WHERE year = ? AND revision = ?`).run(data, userId, now, year, revision);
  if (!result.changes) throw new AnjabError("Data telah disimpan pengguna lain. Muat ulang halaman sebelum menyimpan perubahan Anda.", 409);
  return getAnjabPlan(year);
}
