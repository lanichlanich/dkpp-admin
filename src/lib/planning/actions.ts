import "server-only";
import { z } from "zod";
import { allowed, budgetFor, calculate, methodFor, type Assignment, type Evidence, type Evaluation, type Money } from "./model";
import { auditStatement, commitPlanning, PlanningError, requireAdmin, requireObject, requireVersion, requireWrite, type Change, type PlanningContext } from "./store";

const revision = z.number().int().nonnegative();
const key = z.string().min(1).max(140);
const note = z.string().trim().max(2400);
const short = z.string().trim().max(240);
const requiredNote = note.min(1, "Isi alasan atau rujukan perubahan.");
export const rupiah = z.number().int().min(0).max(10_000_000_000_000);
const decimal = z.number().finite().min(-1e15).max(1e15);
const base = z.object({ version: revision, expectedRevision: revision });
export const actionSchema = z.discriminatedUnion("action", [
  base.extend({ action: z.literal("budget"), nodeId: key, amount: rupiah.nullable(), note: requiredNote }),
  z.object({ action: z.literal("import"), version: revision, note: requiredNote,
    rows: z.array(z.object({ nodeId: key, code: short, amount: rupiah, expectedRevision: revision })).min(1).max(91) }),
  base.extend({ action: z.literal("target"), nodeId: key, indicatorId: key, value: decimal.nullable(), source: requiredNote }),
  base.extend({ action: z.literal("financial"), nodeId: key, amount: rupiah.nullable(), note, correction: note }),
  base.extend({ action: z.literal("evaluation"), nodeId: key, indicatorId: key, real: decimal.nullable(),
    status: z.enum(["draft", "submitted"]), issue: note, followup: note,
    deadline: z.union([z.iso.date(), z.literal("")]), correction: note,
    calculation: z.object({ table: z.number().int(), a: decimal, b: decimal }).nullable() }),
  base.extend({ action: z.literal("review"), nodeId: key, indicatorId: key, status: z.enum(["checked", "returned"]), reviewNote: note, correction: note }),
  base.extend({ action: z.literal("period"), closed: z.boolean(), reason: requiredNote }),
  base.extend({ action: z.literal("assignment"), nodeId: key, indicatorId: key.optional(), departmentId: short.nullable(), ownerUserId: short.nullable() }),
  base.extend({ action: z.literal("access"), userId: key, role: z.enum(["head", "operator", "observer", "remove"]), department: short.nullable() }),
  base.extend({ action: z.literal("archive"), evidenceId: key, archived: z.boolean() }),
]);
type Action = z.infer<typeof actionSchema>;

export function requireOpenPeriod(ctx: PlanningContext, correction?: string) {
  if (ctx.period.closed) throw new PlanningError("Triwulan ini sudah ditutup.", 409);
  if (ctx.period.reopened && correction !== undefined && !correction) throw new PlanningError("Isi alasan koreksi untuk periode yang dibuka kembali.");
}

export function checkEvidenceManagement(ctx: PlanningContext, evidence: Evidence) {
  if (!ctx.evidenceVisible(evidence) || ctx.scope.role === "observer" || (ctx.scope.role === "operator" && evidence.uploadedBy !== ctx.user.id))
    throw new PlanningError("Anda tidak berwenang mengelola bukti ini.", 403);
}

export async function saveAction(ctx: PlanningContext, input: Action) {
  requireVersion(ctx, input.version);
  const { year, quarter } = ctx;
  if (input.action === "access") {
    requireAdmin(ctx);
    if (!ctx.accounts.some(account => account.id === input.userId)) throw new PlanningError("Akun aktif harus memiliki izin menu Pagu, Target & Realisasi.");
    const old = ctx.scopeRows.find(scope => scope.user_id === input.userId);
    if ((old?.revision ?? 0) !== input.expectedRevision) throw new PlanningError("Akses akun telah berubah. Muat ulang.", 409);
    if (input.role !== "remove" && (input.department ? !ctx.catalog.departments.some(dep => dep.id === input.department) : input.role !== "observer"))
      throw new PlanningError("Pilih bidang yang valid untuk akun ini.");
    const value = input.role === "remove" ? null : { role: input.role, department: input.department };
    if (!value && !old) throw new PlanningError("Belum ada cakupan yang ditetapkan.");
    await commitPlanning(ctx, [], [
      value ? {
        sql: `INSERT INTO planning_access(user_id, role, department, revision) VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET role = excluded.role, department = excluded.department, revision = excluded.revision
          WHERE planning_access.revision = ?`,
        values: [input.userId, value.role, value.department, input.expectedRevision + 1, input.expectedRevision], expectChanges: 1,
      } : { sql: "DELETE FROM planning_access WHERE user_id = ? AND revision = ?", values: [input.userId, input.expectedRevision], expectChanges: 1 },
      auditStatement(ctx, "access", input.userId, 0, "Penetapan cakupan akun oleh Admin", old, value),
    ]);
    return;
  }
  if (input.action === "import") {
    requireAdmin(ctx);
    const seen = new Set<string>();
    const changes = input.rows.map(row => {
      const { node } = requireObject(ctx, row.nodeId);
      if (node.type !== "subkegiatan" || seen.has(node.id) || node.code !== row.code) throw new PlanningError("Daftar baris impor tidak sesuai.");
      seen.add(node.id);
      return { kind: "budget", subject: node.id, quarter: 0, revision: row.expectedRevision, data: { amount: row.amount, note: input.note }, reason: input.note } satisfies Change;
    });
    await commitPlanning(ctx, changes);
    return;
  }
  const save = (kind: Change["kind"], subject: string, q: number, data: unknown, reason = "") =>
    commitPlanning(ctx, [{ kind, subject, quarter: q, revision: input.expectedRevision, data, reason }]);
  if (input.action === "period") {
    requireAdmin(ctx);
    if (ctx.period.closed === input.closed) throw new PlanningError("Status periode sudah sesuai.");
    return save("period", "period", quarter, { closed: input.closed, reopened: !input.closed || ctx.period.reopened, reason: input.reason }, input.reason);
  }
  if (input.action === "archive") {
    requireOpenPeriod(ctx);
    const record = ctx.get<Evidence>("evidence", input.evidenceId, quarter);
    if (!record || !ctx.evidenceVisible(record.data)) throw new PlanningError("Bukti tidak ditemukan.", 404);
    checkEvidenceManagement(ctx, record.data);
    if (!input.archived && ctx.evidence.filter(item => item.data.nodeId === record.data.nodeId && !item.data.archived).length >= 20)
      throw new PlanningError("Maksimum 20 bukti aktif per simpul.");
    return save("evidence", record.subject, quarter, { ...record.data, archived: input.archived }, input.archived ? "Arsipkan bukti" : "Pulihkan bukti");
  }
  const { node, indicator, owner } = requireObject(ctx, input.nodeId, "indicatorId" in input ? input.indicatorId : undefined);
  if (input.action === "budget") {
    requireAdmin(ctx);
    if (node.type !== "subkegiatan") throw new PlanningError("Pagu dikelola per subkegiatan.");
    return save("budget", node.id, 0, { amount: input.amount, note: input.note }, input.note);
  }
  if (input.action === "target") {
    requireAdmin(ctx);
    return save("target", indicator!.id, 0, { value: input.value, source: input.source }, input.source);
  }
  if (input.action === "assignment") {
    const kind = indicator ? "indicator_assignment" : "node_assignment", subject = indicator?.id ?? node.id;
    const previous = ctx.get<Assignment>(kind, subject)?.data;
    if (ctx.scope.role !== "admin" && (ctx.scope.role !== "head" || !allowed(ctx.scope, owner.department) ||
      input.departmentId !== (previous?.departmentId ?? null))) throw new PlanningError("Penugasan ini di luar wewenang akun.", 403);
    if (input.departmentId && !ctx.catalog.departments.some(dep => dep.id === input.departmentId))
      throw new PlanningError("Bidang penugasan tidak ditemukan.");
    const parent = indicator ? node : node.parent ? ctx.nodes.get(node.parent) : undefined;
    const effective = input.departmentId ?? (parent ? ctx.assigned(parent).department : null);
    if (input.ownerUserId && (!ctx.actors.has(input.ownerUserId) || ctx.actors.get(input.ownerUserId)?.department !== effective))
      throw new PlanningError("Penanggung jawab harus berasal dari bidang efektif.");
    return save(kind, subject, 0, { departmentId: input.departmentId, ownerUserId: input.ownerUserId }, "Penugasan tahunan");
  }
  requireWrite(ctx, owner.department);
  requireOpenPeriod(ctx, input.correction);
  if (input.action === "financial") {
    if (node.type !== "subkegiatan") throw new PlanningError("Realisasi anggaran diisi per subkegiatan.");
    const budget = budgetFor(node, year, ctx.get<Money>("budget", node.id)).amount;
    let previous: number | null = null;
    for (let q = quarter - 1; q >= 1 && previous === null; q--) previous = ctx.get<Money>("financial", node.id, q)?.data.amount ?? null;
    if (input.amount !== null && ((budget !== null && input.amount > budget) || (previous !== null && input.amount < previous)) && !input.note)
      throw new PlanningError("Isi catatan jika realisasi melebihi pagu atau turun dari triwulan sebelumnya.");
    return save("financial", node.id, quarter, { amount: input.amount, note: input.note }, input.correction || input.note);
  }
  const current = ctx.get<Evaluation>("evaluation", indicator!.id, quarter)?.data;
  if (input.action === "review") {
    if (ctx.scope.role === "operator") throw new PlanningError("Pemeriksaan memerlukan Kepala Bidang atau Admin.", 403);
    if (current?.status !== "submitted") throw new PlanningError("Hanya capaian yang diajukan bisa diperiksa.", 409);
    if (input.status === "returned" && !input.reviewNote) throw new PlanningError("Isi catatan pemeriksa saat mengembalikan.");
    return save("evaluation", indicator!.id, quarter, { ...current, status: input.status, reviewNote: input.reviewNote }, input.correction || input.reviewNote);
  }
  if ((current?.status === "submitted" || current?.status === "checked") && !ctx.period.reopened)
    throw new PlanningError("Capaian harus dikembalikan atau periode dibuka kembali sebelum dikoreksi.", 409);
  const method = methodFor(ctx.catalog, indicator!, year);
  let real = input.real;
  if (input.calculation) {
    if (!method?.kind || method.table !== input.calculation.table) throw new PlanningError("Metode kalkulator tidak sesuai indikator atau tahun.");
    real = calculate(method.kind, input.calculation.a, input.calculation.b);
    if (real === null || !decimal.safeParse(real).success) throw new PlanningError("Angka dasar kalkulator tidak valid.");
  }
  if (real !== null && real < 0 && method?.kind !== "growth" && method?.kind !== "decline")
    throw new PlanningError("Realisasi negatif hanya berlaku untuk indikator pertumbuhan atau penurunan.");
  const target = ctx.get<{ value: number | null }>("target", indicator!.id);
  const effective = target ? target.data.value : indicator!.targets?.[year] ?? null;
  if (input.status === "submitted" && real === null) throw new PlanningError("Isi realisasi sebelum mengajukan.");
  if (input.status === "submitted" && effective === null && !input.issue) throw new PlanningError("Jelaskan kendala jika target belum tersedia.");
  return save("evaluation", indicator!.id, quarter, {
    real, status: input.status, issue: input.issue, followup: input.followup, deadline: input.deadline,
    departmentId: owner.department, owner: owner.ownerName, responsibleUserId: owner.ownerId,
    reviewNote: current?.reviewNote ?? "", calculation: input.calculation,
  }, input.correction);
}
