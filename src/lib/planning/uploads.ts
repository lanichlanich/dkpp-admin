import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { database } from "@/lib/database";
import { createStorageDownloadUrl, createStorageUploadUrl, deleteStorageObject, downloadStorageObject, isStorageConfigured } from "@/lib/storage";
import { EVIDENCE_LIMIT, EVIDENCE_TYPES, XLSX_LIMIT, type Evidence } from "./model";
import { budgetPreview, XLSX_MIME } from "./files";
import { requireOpenPeriod } from "./actions";
import { commitPlanning, PlanningError, requireAdmin, requireObject, requireVersion, requireWrite, type PlanningContext } from "./store";

export const PLANNING_BUCKET = "dkpp-planning";
const storageDir = () => path.join(process.cwd(), "data", "planning-evidence");
const files = {
  "application/pdf": { ext: "pdf", signature: [37, 80, 68, 70, 45] },
  "image/jpeg": { ext: "jpg", signature: [255, 216, 255] },
  "image/png": { ext: "png", signature: [137, 80, 78, 71, 13, 10, 26, 10] },
  [XLSX_MIME]: { ext: "xlsx", signature: [80, 75, 3, 4] },
};
const metadata = z.object({ filename: z.string().trim().min(1).max(240).regex(/^[^/\\\x00-\x1f]+$/), size: z.number().int().positive(), version: z.number().int().nonnegative() });
export const uploadSchema = z.discriminatedUnion("usage", [
  metadata.extend({ usage: z.literal("xlsx"), mime: z.literal(XLSX_MIME) }),
  metadata.extend({ usage: z.literal("evidence"), nodeId: z.string().min(1).max(140), indicatorId: z.string().max(140).optional(),
    title: z.string().trim().min(1).max(240), mime: z.enum(EVIDENCE_TYPES),
    sourceEvidence: z.object({ id: z.uuid(), revision: z.number().int().positive(), checkedAssociation: z.literal(true) }).optional() }),
]);
type Upload = z.infer<typeof uploadSchema>;
type Stage = Upload & { storageName: string; year: number; quarter: number };
const stageExpiry = () => new Date(Date.now() + 2 * 3600_000).toISOString();

function authorizeUpload(ctx: PlanningContext, input: Upload) {
  requireVersion(ctx, input.version);
  if (input.usage === "xlsx") return requireAdmin(ctx);
  if (ctx.quarter !== 4) throw new PlanningError("Bukti final hanya tersedia untuk Triwulan IV.");
  requireOpenPeriod(ctx);
  const { node, owner } = requireObject(ctx, input.nodeId, input.indicatorId);
  requireWrite(ctx, owner);
  if (!input.indicatorId && node.type !== "kegiatan" && node.type !== "subkegiatan")
    throw new PlanningError("Pilih kegiatan, subkegiatan, atau indikator untuk bukti.");
  if (input.sourceEvidence) {
    requireAdmin(ctx);
    const original = ctx.get<Evidence>("evidence", input.sourceEvidence.id, ctx.quarter);
    if (!original?.data.migrationFile || original.data.storageName || original.data.archived ||
      original.data.nodeId !== node.id || original.data.indicatorId !== input.indicatorId ||
      original.revision !== input.sourceEvidence.revision || original.data.mime !== input.mime ||
      original.data.migrationFile.size !== input.size) {
      throw new PlanningError("Metadata bukti sumber tidak cocok atau sudah berubah.", 409);
    }
    return;
  }
  if (ctx.evidence.filter(item => item.data.nodeId === node.id && !item.data.archived).length >= 20)
    throw new PlanningError("Maksimum 20 bukti aktif per simpul.");
}

async function cleanStage(storageName: string) {
  if (isStorageConfigured()) await deleteStorageObject(storageName, PLANNING_BUCKET);
  else await unlink(path.join(storageDir(), storageName)).catch(() => {});
}

async function pruneUploads() {
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  const old = await database.prepare("SELECT id, data_json FROM planning_uploads WHERE expires_at < ? ORDER BY expires_at LIMIT 5").all<{ id: string; data_json: Stage | string }>(cutoff);
  for (const row of old) {
    const stage: Stage = typeof row.data_json === "string" ? JSON.parse(row.data_json) : row.data_json;
    await cleanStage(stage.storageName);
    await database.prepare("DELETE FROM planning_uploads WHERE id = ? AND expires_at < ?").run(row.id, cutoff);
  }
}

export async function prepareUpload(ctx: PlanningContext, input: Upload) {
  authorizeUpload(ctx, input);
  const max = input.usage === "xlsx" ? XLSX_LIMIT : EVIDENCE_LIMIT;
  if (input.size > max) throw new PlanningError(`Ukuran maksimal ${max / 1024 ** 2} MB.`, 413);
  const extensions = input.mime === "image/jpeg" ? ["jpg", "jpeg"] : [files[input.mime].ext];
  if (!extensions.includes(input.filename.split(".").at(-1)?.toLowerCase() ?? "")) throw new PlanningError("Ekstensi dan jenis berkas harus sesuai.");
  await pruneUploads().catch(() => {});
  const pending = await database.prepare("SELECT COUNT(*) AS total FROM planning_uploads WHERE user_id = ? AND expires_at > ?").get<{ total: number }>(ctx.user.id, new Date().toISOString());
  if (Number(pending?.total) >= 20) throw new PlanningError("Terlalu banyak unggahan yang menunggu finalisasi.", 429);
  const id = randomUUID(), storageName = `ptr-${id}.${files[input.mime].ext}`;
  const stage: Stage = { ...input, storageName, year: ctx.year, quarter: ctx.quarter };
  const uploadUrl = isStorageConfigured() ? await createStorageUploadUrl(storageName, PLANNING_BUCKET)
    : `/api/pagu-target-realisasi?year=${ctx.year}&quarter=${ctx.quarter}&upload=${id}`;
  await database.prepare("INSERT INTO planning_uploads(id, user_id, data_json, expires_at) VALUES (?, ?, ?, ?)").run(id, ctx.user.id, JSON.stringify(stage), stageExpiry());
  return { id, uploadUrl };
}

async function getStage(ctx: PlanningContext, id: string) {
  const row = await database.prepare("SELECT data_json FROM planning_uploads WHERE id = ? AND user_id = ? AND expires_at > ?")
    .get<{ data_json: Stage | string }>(id, ctx.user.id, new Date().toISOString());
  if (!row) throw new PlanningError("Izin unggah kedaluwarsa atau tidak ditemukan.", 404);
  const stage: Stage = typeof row.data_json === "string" ? JSON.parse(row.data_json) : row.data_json;
  if (stage.year !== ctx.year || stage.quarter !== ctx.quarter) throw new PlanningError("Unggahan dimulai pada periode lain.");
  return stage;
}

function verifyContents(stage: Stage, bytes: Buffer) {
  if (bytes.length !== stage.size || !files[stage.mime].signature.every((value, index) => value === bytes[index]))
    throw new PlanningError("Ukuran atau isi berkas berbeda dari jenis yang dipilih.");
}

export async function localUpload(ctx: PlanningContext, id: string, file: Request) {
  if (isStorageConfigured()) throw new PlanningError("Gunakan tautan unggah privat.", 403);
  const stage = await getStage(ctx, id);
  authorizeUpload(ctx, stage);
  if (Number(file.headers.get("content-length")) > stage.size) throw new PlanningError("Berkas terlalu besar.", 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  verifyContents(stage, bytes);
  await mkdir(storageDir(), { recursive: true });
  try { await writeFile(path.join(storageDir(), stage.storageName), bytes, { flag: "wx" }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new PlanningError("Berkas sudah diunggah.", 409);
    throw error;
  }
}

export async function finishUpload(ctx: PlanningContext, id: string) {
  const stage = await getStage(ctx, id);
  authorizeUpload(ctx, stage);
  let bytes: Buffer;
  try { bytes = await downloadStorageObject(stage.storageName, path.join(storageDir(), stage.storageName), PLANNING_BUCKET); }
  catch { throw new PlanningError("Berkas unggahan belum ditemukan.", 422); }
  verifyContents(stage, bytes);
  if (stage.usage === "xlsx") {
    try { return await budgetPreview(ctx, bytes); }
    finally {
      try { await cleanStage(stage.storageName); await database.prepare("DELETE FROM planning_uploads WHERE id = ? AND user_id = ?").run(id, ctx.user.id); }
      catch { /* Staging cleanup will retry on the next upload. */ }
    }
  }
  let data: Evidence = {
    nodeId: stage.nodeId, indicatorId: stage.indicatorId ?? null, title: stage.title, filename: stage.filename,
    mime: stage.mime, size: bytes.length, uploadedBy: ctx.user.id, uploadedAt: new Date().toISOString(),
    archived: false, storageName: stage.storageName,
  };
  const original = stage.sourceEvidence && ctx.get<Evidence>("evidence", stage.sourceEvidence.id, 4);
  if (original?.data.migrationFile) {
    if (createHash("sha256").update(bytes).digest("hex") !== original.data.migrationFile.sha256)
      throw new PlanningError("SHA-256 berkas berbeda dari bukti SIPENA.");
    data = { ...original.data, storageName: stage.storageName, migrationFile: { ...original.data.migrationFile, verifyAssociation: false } };
  }
  await commitPlanning(ctx, [{ kind: "evidence", subject: original?.subject ?? id, quarter: 4, revision: original?.revision ?? 0,
    data, reason: original ? "Bukti SIPENA dipindahkan setelah kecocokan diperiksa Admin" : "Unggah bukti final" }], [{
    sql: "DELETE FROM planning_uploads WHERE id = ? AND user_id = ? AND expires_at > ?", values: [id, ctx.user.id, new Date().toISOString()], expectChanges: 1,
  }]);
  return null;
}

export async function evidenceDownload(ctx: PlanningContext, id: string) {
  const record = ctx.get<Evidence>("evidence", id, ctx.quarter), data = record?.data;
  if (!data || !ctx.canReadEvidence(data)) throw new PlanningError("Bukti tidak ditemukan.", 404);
  if (!data.storageName) throw new PlanningError("Berkas belum dipindahkan.", 404);
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (isStorageConfigured()) return new Response(null, { status: 302, headers: { ...headers, Location: await createStorageDownloadUrl(data.storageName, data.filename, PLANNING_BUCKET) } });
  const file = await downloadStorageObject(data.storageName, path.join(storageDir(), data.storageName), PLANNING_BUCKET);
  return new Response(new Uint8Array(file), { headers: { ...headers, "Content-Type": data.mime,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(data.filename)}` } });
}
