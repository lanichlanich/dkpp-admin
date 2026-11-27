import type { ScheduleEmployee, WorkLocation } from "./wfh-schedule";

export type ScheduleRow = { employee: ScheduleEmployee; statuses: Record<string, WorkLocation> };
export type ScheduleSortKey = keyof ScheduleEmployee | `${number}-${number}-${number}`;
export type ScheduleSort = { key: ScheduleSortKey; direction: "asc" | "desc" };
const collator = new Intl.Collator("id", { numeric: true, sensitivity: "base" });

export function sortScheduleRows(rows: readonly ScheduleRow[], sort: ScheduleSort | null, overrides: Record<string, WorkLocation>) {
  if (!sort) return rows;
  const key = sort.key;
  const value = (row: ScheduleRow) => key === "name" || key === "nip" || key === "position" || key === "unit"
    ? row.employee[key]
    : overrides[`${row.employee.nip}:${key}`] ?? row.statuses[key] ?? "WFO";
  return rows.toSorted((a, b) => (sort.direction === "asc" ? 1 : -1) * collator.compare(value(a), value(b)) || collator.compare(a.employee.name, b.employee.name) || a.employee.nip.localeCompare(b.employee.nip));
}
