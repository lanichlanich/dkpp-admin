export const PLANNING_MENU = "pagu-target-realisasi";
export const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];
export const LEVELS = ["tujuan", "sasaran", "program", "kegiatan", "subkegiatan", "iku"] as const;
export const EVIDENCE_LIMIT = 10 * 1024 * 1024;
export const XLSX_LIMIT = 5 * 1024 * 1024;
export const EVIDENCE_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export type Role = "admin" | "head" | "operator" | "observer";
export type Scope = { role: Role; department: string | null };
export type Source = { doc?: string; page?: number; printedPage?: number; table?: string; status?: string };
export type Indicator = {
  id: string; name: string; unit: string; direction: "higher" | "lower"; iku?: boolean;
  baseline?: number | null; targets?: Record<string, number | null>; budgets?: Record<string, number | null>;
  source?: Source; review?: string;
};
export type PlanningNode = {
  id: string; parent: string | null; type: Exclude<typeof LEVELS[number], "iku">;
  code: string; title: string; source?: Source; indicators: Indicator[];
};
export type Method = {
  table: number; bindings?: Record<string, [string, string]>; fields: Record<string, string>;
  kind?: "growth" | "decline" | "ratio" | "average"; labels?: [string, string];
};
export type Assignment = { departmentId?: string | null; ownerUserId?: string | null; ownerName?: string | null };
export type Catalog = {
  snapshot: { exportedAt: string; planningRevision: number };
  nodes: PlanningNode[]; departments: { id: string; name: string }[];
  documents: { id: string; name: string; kind: string; period: string; note: string }[];
  links: Record<string, unknown>; methods: Method[]; actors: { ref: string; displayName: string; departmentId: string | null }[];
};
export type RecordKind = "budget" | "financial" | "target" | "evaluation" | "node_assignment" | "indicator_assignment" | "period" | "evidence";
export type PlanningRecord<T = unknown> = { kind: RecordKind; subject: string; quarter: number; revision: number; data: T };
export type Money = { amount: number | null; note: string };
export type Evaluation = {
  real: number | null; status: "draft" | "submitted" | "checked" | "returned"; issue: string; followup: string;
  deadline: string; reviewNote: string; departmentId?: string | null; owner?: string | null;
  calculation?: { table: number; a: number; b: number } | null;
};
export type Evidence = {
  nodeId: string; indicatorId?: string | null; title: string; filename: string; mime: string;
  size: number; uploadedBy: string; uploadedAt: string; archived: boolean; storageName?: string;
  migrationFile?: { name: string; sha256: string; size: number; verifyAssociation: boolean };
};
export type Period = { closed: boolean; reopened: boolean; reason: string };
export const OPEN_PERIOD: Period = { closed: false, reopened: false, reason: "" };

export function budgetFor(node: PlanningNode, year: number, override?: PlanningRecord<Money>) {
  if (override) return { amount: override.data.amount, source: "Pagu Admin", note: override.data.note };
  const values = new Set(node.indicators
    .filter(indicator => !isExample(indicator.source))
    .map(indicator => indicator.budgets?.[year]).filter(value => value != null));
  const amount = values.size === 1 ? [...values][0]! : null;
  const source = values.size > 1 ? "Perlu verifikasi" : amount !== null ? "Indikatif Renstra" : "Belum tersedia";
  return { amount, source, note: "" };
}

export function isExample(source?: Source) {
  return /^(example|sample|contoh|demo)$/i.test(source?.status ?? "");
}

export type Amounts = { budget: number | null; real: number | null };
export function summarize(rows: Amounts[]) {
  let budget = 0, real = 0, pairBudget = 0, pairReal = 0, budgetCount = 0, realCount = 0, pairCount = 0;
  for (const row of rows) {
    if (row.budget !== null) { budget += row.budget; budgetCount++; }
    if (row.real !== null) { real += row.real; realCount++; }
    if (row.budget !== null && row.real !== null) {
      pairBudget += row.budget; pairReal += row.real; pairCount++;
    }
  }
  return {
    budget: budgetCount ? budget : null, real: realCount ? real : null,
    absorption: pairBudget > 0 ? 100 * pairReal / pairBudget : null,
    remaining: rows.length && pairCount === rows.length ? pairBudget - pairReal : null,
    budgetCount, realCount, pairCount, count: rows.length,
  };
}

export function achievement(target: number | null, real: number | null, direction: Indicator["direction"]) {
  if (target === null || real === null) return null;
  if (direction === "lower") return real === 0 ? (target >= 0 ? 100 : null) : 100 * target / real;
  return target > 0 ? 100 * real / target : null;
}

export function calculate(kind: NonNullable<Method["kind"]>, a: number, b: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b <= 0 || (kind === "average" && !Number.isInteger(b))) return null;
  const value = kind === "growth" ? ((a - b) / b) * 100 : kind === "decline" ? ((b - a) / b) * 100
    : kind === "ratio" ? (a / b) * 100 : a / b;
  return Number.isFinite(value) ? value : null;
}

export function methodFor(catalog: Catalog, indicator: Indicator, year: number) {
  const method = catalog.methods.find(entry => Object.hasOwn(entry.bindings ?? {}, indicator.id));
  if (!method) return null;
  const [name, unit] = method.bindings![indicator.id];
  const kind = year <= 2029 && name === indicator.name && unit === indicator.unit ? method.kind : undefined;
  return { ...method, kind };
}

export function allowed(scope: Scope, department: string | null) {
  return scope.role === "admin" || (scope.department === null ? scope.role === "observer" : scope.department === department);
}

export function canWrite(scope: Scope, department: string | null) {
  return scope.role !== "observer" && allowed(scope, department);
}

export function assignmentFrom(entries: Assignment[], actorDepartment: (id: string) => string | null) {
  const department = entries.find(entry => entry.departmentId != null)?.departmentId || null;
  for (const entry of entries) {
    if (entry.ownerUserId === "" || entry.ownerName === "") break;
    if (entry.departmentId && entry.departmentId !== department) continue;
    if (entry.ownerUserId && actorDepartment(entry.ownerUserId) === department) return { department, ownerId: entry.ownerUserId, ownerName: null };
    if (entry.ownerName && entry.departmentId === department) return { department, ownerId: null, ownerName: entry.ownerName };
  }
  return { department, ownerId: null, ownerName: null };
}
