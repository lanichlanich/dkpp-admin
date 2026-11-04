import { z } from "zod";

export type Staffing = { needPns: number; needPppk: number; existingPns: number; existingPppk: number };
export type ActivityInput = { volume: number; credit: number };
export type LevelInput = { divisor: number; tasks: Record<string, ActivityInput>; staffing: Staffing; placements: Record<string, { pns: number; pppk: number }> };
export type Variables = { agencyType: "A" | "B" | "C" | "D"; districtCount: number; serviceUnitCount: number; weights: { agency: number; districts: number; serviceUnits: number }; shares: Record<string, number> };
export type AnjabPlan = { version: 1; variables: Variables; levels: Record<string, LevelInput> };
export type SourceTask = ActivityInput & { id: string; row: number; description: string; group: string; unit: string; sourceResult: number | null; output?: string };
export type SourceLevel = { id: string; grade: string; sheet: string; title: string; totalCell: string; sumFormula: string; sourceTotal: number; divisorCell: string; divisor: number; requirementCell: string; requirementLabel: string; recommendationRow: number; sourceNeed: number; verifiedNeed: number; verifiedTotal: number; tasks: SourceTask[]; staffing: Staffing; placements: LevelInput["placements"]; issues: { kind: string; message: string; cells: string[] }[] };
export type SourceFamily = { id: string; name: string; shortName: string; sourceFile: string; levels: SourceLevel[] };
export type SourceCatalog = { schemaVersion: number; baseYear: number; recommendationFile: string; agencyName: string; units: { id: string; name: string }[];
  families: SourceFamily[]; variables: Variables; sources: { file: string; sha256: string; sheets: { name: string; state: string; rows: number; columns: number; cells: number; formulas: number; formulaErrors: number; role: string }[] }[] };
export const allAnjabLevels = (catalog: SourceCatalog) => catalog.families.flatMap(family => family.levels);
export const weightedAnjabFamilies = (catalog: SourceCatalog) => catalog.families.filter(family => Object.hasOwn(catalog.variables.shares, family.id));

export function defaultAnjabPlan(catalog: SourceCatalog): AnjabPlan {
  return {
    version: 1, variables: structuredClone(catalog.variables),
    levels: Object.fromEntries(allAnjabLevels(catalog).map(level => [level.id, {
      divisor: level.divisor,
      tasks: Object.fromEntries(level.tasks.map(task => [task.id, { volume: task.volume, credit: task.credit }])),
      staffing: structuredClone(level.staffing), placements: structuredClone(level.placements),
    }])),
  };
}

const number = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
const count = number.int();
const staffing = z.object({ needPns: count, needPppk: count, existingPns: count, existingPppk: count }).strict();
const input = z.object({ divisor: number.positive(), tasks: z.record(z.string(), z.object({ volume: number, credit: number }).strict()), staffing,
  placements: z.record(z.string(), z.object({ pns: count, pppk: count }).strict()) }).strict();
const share = z.number().finite().min(0).max(1);
function sameKeys(value: Record<string, unknown>, expected: string[]) {
  const keys = Object.keys(value); return keys.length === expected.length && expected.every(key => Object.hasOwn(value, key));
}
export function createAnjabPlanSchema(catalog: SourceCatalog) {
const anjabLevels = allAnjabLevels(catalog), weightedFamilies = weightedAnjabFamilies(catalog), anjabUnits = catalog.units;
return z.object({
  version: z.literal(1), variables: z.object({ agencyType: z.enum(["A", "B", "C", "D"]), districtCount: count, serviceUnitCount: count,
    weights: z.object({ agency: share, districts: share, serviceUnits: share }).strict(), shares: z.record(z.string(), share) }).strict(),
  levels: z.record(z.string(), input),
}).strict().superRefine((plan, ctx) => {
  if (!sameKeys(plan.levels, anjabLevels.map(level => level.id))) ctx.addIssue({ code: "custom", path: ["levels"], message: "Daftar 23 jenjang harus lengkap dan sesuai katalog." });
  if (!sameKeys(plan.variables.shares, weightedFamilies.map(family => family.id))) ctx.addIssue({ code: "custom", path: ["variables", "shares"], message: "Proporsi formasi harus berisi empat JF peternakan pada lampiran." });
  for (const [key, values] of [["weights", Object.values(plan.variables.weights)], ["shares", Object.values(plan.variables.shares)]] as const)
    if (Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 1e-8) ctx.addIssue({ code: "custom", path: ["variables", key], message: `Total ${key === "weights" ? "bobot variabel" : "proporsi jabatan"} harus 100%.` });
  for (const level of anjabLevels) {
    const current = plan.levels[level.id]; if (!current) continue;
    if (!sameKeys(current.tasks, level.tasks.map(task => task.id))) ctx.addIssue({ code: "custom", path: ["levels", level.id, "tasks"], message: `Butir kegiatan ${level.grade} harus lengkap sesuai sumber.` });
    if (!sameKeys(current.placements, anjabUnits.map(unit => unit.id))) ctx.addIssue({ code: "custom", path: ["levels", level.id, "placements"], message: "Enam unit penempatan harus lengkap." });
    for (const task of Object.values(current.tasks)) if (task.volume * task.credit > Number.MAX_SAFE_INTEGER)
      ctx.addIssue({ code: "custom", path: ["levels", level.id, "tasks"], message: "Hasil volume dikali angka kredit terlalu besar." });
    const total = Object.values(current.tasks).reduce((sum, task) => sum + task.volume * task.credit, 0);
    if (total > Number.MAX_SAFE_INTEGER || total / current.divisor > Number.MAX_SAFE_INTEGER)
      ctx.addIssue({ code: "custom", path: ["levels", level.id], message: "Total atau hasil kebutuhan terlalu besar untuk dihitung dengan akurat." });
  }
  if (anjabLevels.every(level => plan.levels[level.id]) && Object.values(calculateAnjab(plan, catalog).total).some(value => value === null))
    ctx.addIssue({ code: "custom", path: ["levels"], message: "Lengkapi isian dan pastikan total kebutuhan/pegawai masih berada dalam batas angka yang dapat dihitung dengan akurat." });
});
}

export function validAnjabYear(year: number) { return Number.isInteger(year) && year >= 2000 && year <= 2099; }
const finitePositive = (value: number | undefined) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const clean = (value: number) => Number(value.toPrecision(15));
function sum(values: Array<number | null>): number | null {
  if (!values.every(value => value !== null && Number.isFinite(value))) return null;
  const total = clean((values as number[]).reduce((a, b) => a + b, 0));
  return Math.abs(total) <= Number.MAX_SAFE_INTEGER ? total : null;
}
const safeCount = (value: number) => Number.isSafeInteger(value) && value >= 0 ? value : null;
export function excelRound(value: number) { return Math.round(value + Number.EPSILON * Math.max(1, value) * 2); }
export function calculateAnjabLevel(level: SourceLevel, current: LevelInput, anjabUnits: SourceCatalog["units"]) {
  const points = Object.fromEntries(level.tasks.map(task => {
    const entry = current.tasks[task.id];
    return [task.id, entry && finitePositive(entry.volume) && finitePositive(entry.credit) ? clean(entry.volume * entry.credit) : null];
  }));
  const total = sum(Object.values(points));
  const candidate = total !== null && Number.isFinite(current.divisor) && current.divisor > 0 ? clean(total / current.divisor) : null;
  const ratio = candidate !== null && Number.isFinite(candidate) && candidate <= Number.MAX_SAFE_INTEGER ? candidate : null;
  const need = ratio === null ? null : excelRound(ratio);
  const proposedPns = safeCount(current.staffing.needPns), proposedPppk = safeCount(current.staffing.needPppk);
  const existingPns = safeCount(current.staffing.existingPns), existingPppk = safeCount(current.staffing.existingPppk);
  const proposed = sum([proposedPns, proposedPppk]), existing = sum([existingPns, existingPppk]);
  const placedPns = sum(anjabUnits.map(unit => safeCount(current.placements[unit.id]?.pns)));
  const placedPppk = sum(anjabUnits.map(unit => safeCount(current.placements[unit.id]?.pppk)));
  const placed = sum([placedPns, placedPppk]);
  return { points, total, ratio, need, proposedPns, proposedPppk, proposed, existingPns, existingPppk, existing,
    shortage: proposed !== null && existing !== null ? proposed - existing : null,
    abkShortage: need !== null && existing !== null ? need - existing : null,
    placedPns, placedPppk, placed, placementDifference: placed !== null && proposed !== null ? placed - proposed : null,
    pnsPlacementDifference: placedPns !== null && proposedPns !== null ? placedPns - proposedPns : null,
    pppkPlacementDifference: placedPppk !== null && proposedPppk !== null ? placedPppk - proposedPppk : null };
}

export function calculateAnjab(plan: AnjabPlan, catalog: SourceCatalog) {
  const anjabLevels = allAnjabLevels(catalog), anjabFamilies = catalog.families, weightedFamilies = weightedAnjabFamilies(catalog);
  const levels = Object.fromEntries(anjabLevels.map(level => [level.id, calculateAnjabLevel(level, plan.levels[level.id], catalog.units)]));
  const aggregate = (ids: string[]) => Object.fromEntries((["need", "proposedPns", "proposedPppk", "proposed", "existingPns", "existingPppk", "existing", "shortage", "abkShortage", "placedPns", "placedPppk", "placed"] as const)
    .map(key => [key, sum(ids.map(id => levels[id][key]))])) as Record<"need" | "proposedPns" | "proposedPppk" | "proposed" | "existingPns" | "existingPppk" | "existing" | "shortage" | "abkShortage" | "placedPns" | "placedPppk" | "placed", number | null>;
  const families = Object.fromEntries(anjabFamilies.map(family => [family.id, aggregate(family.levels.map(level => level.id))]));
  const v = plan.variables, typeScore = ({ A: 100, B: 75, C: 50, D: 25 })[v.agencyType];
  const districtScore = v.districtCount <= 10 ? 25 : v.districtCount <= 20 ? 50 : v.districtCount <= 30 ? 75 : 100;
  const unitScore = v.serviceUnitCount === 0 ? 25 : v.serviceUnitCount <= 3 ? 50 : v.serviceUnitCount <= 9 ? 75 : 100;
  const validWeights = [...Object.values(v.weights), ...Object.values(v.shares)].every(x => Number.isFinite(x) && x >= 0 && x <= 1)
    && Math.abs(Object.values(v.weights).reduce((a, b) => a + b, 0) - 1) < 1e-8
    && Math.abs(Object.values(v.shares).reduce((a, b) => a + b, 0) - 1) < 1e-8;
  const score = validWeights && safeCount(v.districtCount) !== null && safeCount(v.serviceUnitCount) !== null
    ? clean(typeScore * v.weights.agency + districtScore * v.weights.districts + unitScore * v.weights.serviceUnits) : null;
  const allocations = Object.fromEntries(weightedFamilies.map(family => [family.id, score === null ? null : Math.floor(clean(score * v.shares[family.id]))]));
  const allocated = sum(Object.values(allocations)), weightedExisting = sum(weightedFamilies.map(family => families[family.id].existing));
  return { levels, families, total: aggregate(anjabLevels.map(level => level.id)), agency: { typeScore, districtScore, unitScore, score, allocations, allocated,
    remainder: score !== null && allocated !== null ? clean(score - allocated) : null, existing: weightedExisting,
    scoreShortage: score !== null && weightedExisting !== null ? clean(score - weightedExisting) : null,
    shortage: allocated !== null && weightedExisting !== null ? allocated - weightedExisting : null } };
}
