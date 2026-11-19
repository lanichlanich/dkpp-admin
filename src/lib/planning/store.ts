import "server-only";
import { randomUUID } from "node:crypto";
import { database, TransactionConflict } from "@/lib/database";
import type { PublicUser } from "@/lib/db-types";
import { parseMenuPermissions } from "@/lib/access-control";
import {
  allowed, assignmentFrom, budgetFor, canWrite, isExample, methodFor, OPEN_PERIOD, PLANNING_MENU, YEARS,
  type Assignment, type Catalog, type Evidence, type Evaluation, type Money, type Period,
  type PlanningNode, type PlanningRecord, type RecordKind, type Scope,
} from "./model";

export class PlanningError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}

type AccessRow = { user_id: string; role: Scope["role"]; department: string | null; revision: number };
type Account = { id: string; name: string; username: string; menu_permissions: string | null; role_permissions: string | null };

const recordKey = (kind: RecordKind, subject: string, quarter: number) => JSON.stringify([kind, subject, quarter]);
const decode = <T>(value: T | string): T => typeof value === "string" ? JSON.parse(value) : value;

export async function loadPlanning(user: PublicUser, year: number, quarter: number) {
  if (!YEARS.includes(year) || ![1, 2, 3, 4].includes(quarter)) throw new PlanningError("Tahun atau triwulan tidak valid.");
  const version = await database.prepare("SELECT revision FROM planning_years WHERE year = ?").get<{ revision: number }>(year);
  const scopeRows = await database.prepare("SELECT user_id, role, department, revision FROM planning_access").all<AccessRow>();
  const own = scopeRows.find(row => row.user_id === user.id);
  if (!user.isAdministrator && !own) throw new PlanningError("Minta Admin menetapkan peran dan cakupan bidang untuk akun Anda.", 403);
  const scope: Scope = user.isAdministrator ? { role: "admin", department: null } : own!;
  const catalogRow = await database.prepare("SELECT data_json FROM planning_catalog WHERE source_system = 'sipena'").get<{ data_json: Catalog | string }>();
  if (!catalogRow || !version) throw new PlanningError("Data awal SIPENA belum dimuat.", 503);
  const catalog = decode(catalogRow.data_json);
  const rows = await database.prepare("SELECT kind, subject, quarter, revision, data_json FROM planning_records WHERE year = ?").all<Omit<PlanningRecord, "data"> & { data_json: unknown }>(year);
  const byKey = new Map(rows.map(row => [recordKey(row.kind, row.subject, row.quarter), { kind: row.kind, subject: row.subject, quarter: row.quarter, revision: row.revision, data: decode(row.data_json) }]));
  const get = <T>(kind: RecordKind, subject: string, q = 0) => byKey.get(recordKey(kind, subject, q)) as PlanningRecord<T> | undefined;
  const allAccounts = await database.prepare(`SELECT u.id, u.name, u.username, u.menu_permissions, r.menu_permissions AS role_permissions
    FROM users u LEFT JOIN app_roles r ON r.id = u.role_id WHERE u.is_active = 1 ORDER BY u.name`).all<Account>();
  const accounts = allAccounts.filter(account => parseMenuPermissions(account.menu_permissions ?? account.role_permissions).includes(PLANNING_MENU));
  const actors = new Map(catalog.actors.map(actor => [actor.ref, { name: actor.displayName, department: actor.departmentId }]));
  for (const account of accounts) {
    const access = scopeRows.find(row => row.user_id === account.id);
    if (access) actors.set(account.id, { name: account.name, department: access.department });
  }
  const nodes = new Map(catalog.nodes.map(node => [node.id, node]));
  const indicators = new Map(catalog.nodes.flatMap(node => node.indicators.map(indicator => [indicator.id, { indicator, node }] as const)));
  const ancestry = (node: PlanningNode) => {
    const chain = [node];
    for (let parent = node.parent && nodes.get(node.parent); parent; parent = parent.parent && nodes.get(parent.parent)) chain.push(parent);
    return chain;
  };
  const assigned = (node: PlanningNode, indicatorId?: string) => {
    const entries = ancestry(node).map(parent => get<Assignment>("node_assignment", parent.id)?.data ?? {});
    if (indicatorId) entries.unshift(get<Assignment>("indicator_assignment", indicatorId)?.data ?? {});
    const assignment = assignmentFrom(entries, id => actors.get(id)?.department ?? null);
    return { ...assignment, ownerName: assignment.ownerName ?? (assignment.ownerId ? actors.get(assignment.ownerId)?.name : null) ?? null };
  };
  const evidence = [...byKey.values()].filter(record => record.kind === "evidence" && record.quarter === quarter) as PlanningRecord<Evidence>[];
  const periodRecord = get<Period>("period", "period", quarter);
  const period = periodRecord?.data ?? OPEN_PERIOD;
  const evidenceVisible = (data: Evidence) => {
    const node = nodes.get(data.nodeId);
    return !!node && allowed(scope, assigned(node, data.indicatorId ?? undefined).department);
  };
  return {
    user, year, quarter, scope, scopeRows, accounts, actors, catalog, version: version.revision, get, nodes, indicators, ancestry, assigned,
    evidence, evidenceVisible, periodRecord, period,
  };
}

export type PlanningContext = Awaited<ReturnType<typeof loadPlanning>>;

export function planningView(ctx: PlanningContext) {
  const { scope, catalog, year, quarter, assigned, get, period, periodRecord } = ctx;
  const isAdmin = scope.role === "admin";
  const viewNodes = catalog.nodes.filter(node => !isExample(node.source)).map(node => {
    const owner = assigned(node), visible = allowed(scope, owner.department);
    const budgetRecord = visible ? get<Money>("budget", node.id) : undefined;
    const financial = visible ? get<Money>("financial", node.id, quarter) : undefined;
    const assignment = visible ? get<Assignment>("node_assignment", node.id) : undefined;
    return {
      id: node.id, parent: node.parent, code: node.code, type: node.type, title: node.title, source: node.source,
      visible, owner: visible ? owner : null, assignment, budgetRecord, financial,
      budget: visible && node.type === "subkegiatan" ? budgetFor(node, year, budgetRecord) : null,
      indicators: node.indicators.filter(indicator => !isExample(indicator.source) && allowed(scope, assigned(node, indicator.id).department)).map(indicator => {
        const target = get<{ value: number | null; source: string }>("target", indicator.id);
        return {
          id: indicator.id, name: indicator.name, unit: indicator.unit, direction: indicator.direction, iku: !!indicator.iku,
          baseline: indicator.baseline, review: indicator.review, source: indicator.source,
          target, effectiveTarget: target ? target.data.value : indicator.targets?.[year] ?? null,
          evaluation: get<Evaluation>("evaluation", indicator.id, quarter), assignment: get<Assignment>("indicator_assignment", indicator.id),
          owner: assigned(node, indicator.id), method: methodFor(catalog, indicator, year),
        };
      }),
    };
  });
  const include = new Set<string>();
  for (const node of viewNodes) {
    if (!node.visible && !node.indicators.length) continue;
    for (const ancestor of ctx.ancestry(ctx.nodes.get(node.id)!)) include.add(ancestor.id);
  }
  return {
    year, quarter, version: ctx.version, scope, period, periodRevision: periodRecord?.revision ?? 0, snapshot: catalog.snapshot,
    documents: catalog.documents, departments: catalog.departments.filter(dep => !scope.department || dep.id === scope.department),
    nodes: viewNodes.filter(node => include.has(node.id)),
    evidence: ctx.evidence.filter(record => ctx.evidenceVisible(record.data) && (!record.data.archived || (scope.role !== "observer" &&
      (scope.role !== "operator" || record.data.uploadedBy === ctx.user.id)))).map(record => {
      const { storageName, ...data } = record.data;
      return { ...record, data, available: !!storageName, mine: data.uploadedBy === ctx.user.id };
    }),
    accounts: isAdmin ? ctx.accounts.map(({ id, name, username }) => ({ id, name, username, access: ctx.scopeRows.find(row => row.user_id === id) })) : [],
    owners: [...ctx.actors].filter(([, actor]) => !scope.department || actor.department === scope.department)
      .map(([id, actor]) => ({ id, ...actor })),
  };
}
export type PlanningView = ReturnType<typeof planningView>;

export function requireVersion(ctx: PlanningContext, version: number) {
  if (ctx.version !== version) throw new PlanningError("Data telah berubah. Muat ulang dan periksa kembali.", 409);
}

export function requireObject(ctx: PlanningContext, nodeId: string, indicatorId?: string) {
  const node = ctx.nodes.get(nodeId), item = indicatorId ? ctx.indicators.get(indicatorId) : undefined;
  if (!node || isExample(node.source) || (indicatorId && (!item || item.node.id !== nodeId || isExample(item.indicator.source))))
    throw new PlanningError("Jabatan perencanaan atau indikator tidak ditemukan.", 404);
  return { node, indicator: item?.indicator, owner: ctx.assigned(node, indicatorId) };
}

export function requireWrite(ctx: PlanningContext, department: string | null) {
  if (!canWrite(ctx.scope, department)) throw new PlanningError("Aksi tidak diizinkan untuk bidang ini.", 403);
}

export function requireAdmin(ctx: PlanningContext) {
  if (ctx.scope.role !== "admin") throw new PlanningError("Aksi ini hanya untuk Admin.", 403);
}

export type Change = { kind: RecordKind; subject: string; quarter: number; revision: number; data: unknown; reason: string };

type Statement = Parameters<typeof database.transaction>[0][number];
export function auditStatement(ctx: PlanningContext, kind: string, subject: string, quarter: number, reason: string, old: unknown, value: unknown): Statement {
  return {
    sql: "INSERT INTO planning_audit(id, year, quarter, kind, subject, actor, at_utc, reason, old_json, new_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    values: [randomUUID(), ctx.year, quarter, kind, subject, ctx.user.id, new Date().toISOString(), reason, old == null ? null : JSON.stringify(old), JSON.stringify(value)],
  };
}

export async function commitPlanning(ctx: PlanningContext, changes: Change[], extra: Statement[] = []) {
  const statements: Statement[] = [{
    sql: "UPDATE planning_years SET revision = revision + 1 WHERE year = ? AND revision = ?",
    values: [ctx.year, ctx.version], expectChanges: 1,
  }];
  for (const change of changes) {
    const { kind, subject, quarter, revision, data, reason } = change;
    const old = ctx.get(kind, subject, quarter);
    if ((old?.revision ?? 0) !== revision) throw new PlanningError("Versi data berubah. Muat ulang terlebih dahulu.", 409);
    statements.push({
      sql: `INSERT INTO planning_records(year, kind, subject, quarter, revision, data_json, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(year, kind, subject, quarter) DO UPDATE SET revision = excluded.revision, data_json = excluded.data_json,
        updated_at = excluded.updated_at, updated_by = excluded.updated_by WHERE planning_records.revision = ?`,
      values: [ctx.year, kind, subject, quarter, revision + 1, JSON.stringify(data), new Date().toISOString(), ctx.user.id, revision],
      expectChanges: 1,
    }, auditStatement(ctx, kind, subject, quarter, reason, old?.data, data));
  }
  try {
    await database.transaction([...statements, ...extra]);
  } catch (error) {
    if (error instanceof TransactionConflict) throw new PlanningError("Data berubah saat disimpan. Muat ulang dan periksa kembali.", 409);
    throw error;
  }
}
