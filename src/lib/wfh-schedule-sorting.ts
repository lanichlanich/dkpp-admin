import type { ScheduleEmployee, WorkLocation } from "./wfh-schedule";

export type ScheduleRow = { employee: ScheduleEmployee; statuses: Record<string, WorkLocation> };
export type ScheduleSortKey = keyof ScheduleEmployee | `${number}-${number}-${number}`;
export type ScheduleSort = { key: ScheduleSortKey; direction: "asc" | "desc" };
const collator = new Intl.Collator("id", { numeric: true, sensitivity: "base" });

const identityKeys = new Set(["name", "nip", "position", "unit"]);
const isIdentity = (key: string): key is keyof ScheduleEmployee => identityKeys.has(key);
function columnValue(row: ScheduleRow, key: string, overrides: Record<string, WorkLocation>) {
  return isIdentity(key) ? row.employee[key] : overrides[`${row.employee.nip}:${key}`] ?? row.statuses[key] ?? "WFO";
}

export function filterScheduleRows(rows: readonly ScheduleRow[], search: string, filters: Record<string, string>, overrides: Record<string, WorkLocation>) {
  const normalize = (value: string) => value.trim().toLocaleLowerCase("id-ID");
  const query = normalize(search);
  const active = Object.entries(filters).map(([key, value]) => [key, normalize(value)] as const).filter(([, value]) => value);
  return rows.filter(row => normalize(`${row.employee.name} ${row.employee.nip} ${row.employee.unit}`).includes(query) && active.every(([key, query]) => {
    const value = normalize(columnValue(row, key, overrides));
    return isIdentity(key) ? value.includes(query) : value === query;
  }));
}

export function sortScheduleRows(rows: readonly ScheduleRow[], sort: ScheduleSort | null, overrides: Record<string, WorkLocation>) {
  if (!sort) return rows;
  const value = (row: ScheduleRow) => columnValue(row, sort.key, overrides);
  return rows.toSorted((a, b) => (sort.direction === "asc" ? 1 : -1) * collator.compare(value(a), value(b)) || collator.compare(a.employee.name, b.employee.name) || a.employee.nip.localeCompare(b.employee.nip));
}
