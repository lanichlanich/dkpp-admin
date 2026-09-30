import "server-only";

import { database as db } from "@/lib/database";

export type WorkLocation = "WFH" | "WFO";

export type ScheduleEntry = {
  period: string;
  employeeNip: string;
  employeeName: string;
  position: string;
  unit: string;
  sortOrder: number;
  fridayDate: string;
  status: WorkLocation;
};

export type ScheduleMonth = {
  period: string;
  sourcePeriod: string | null;
};

export type ScheduleEmployee = {
  nip: string;
  name: string;
  position: string;
  unit: string;
};

export function validPeriod(period: string) {
  return /^(20\d{2})-(0[1-9]|1[0-2])$/.test(period);
}

export function monthLabel(period: string) {
  if (!validPeriod(period)) return period;
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${period}-01T00:00:00Z`));
}

export function fridayDates(period: string) {
  if (!validPeriod(period)) return [];
  const [year, month] = period.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dates: string[] = [];
  for (let day = 1; day <= days; day++) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCDay() === 5) dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

export function nextPeriod(period: string, offset: number) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

export async function getScheduleMonths() {
  return await db.prepare(
    `SELECT period, source_period AS sourcePeriod
     FROM wfh_schedule_months ORDER BY period DESC`,
  ).all() as ScheduleMonth[];
}

export async function getScheduleEntries(period: string) {
  if (!validPeriod(period)) return [];
  return await db.prepare(
    `SELECT period, employee_nip AS employeeNip, employee_name AS employeeName,
            position, unit, sort_order AS sortOrder, CAST(friday_date AS TEXT) AS fridayDate, status
     FROM wfh_schedule_entries WHERE period = ?
     ORDER BY sort_order, employee_name, employee_nip, friday_date`,
  ).all(period) as ScheduleEntry[];
}

export async function getActiveScheduleEmployees() {
  return await db.prepare(
    `SELECT nip, name, position, unit FROM employees
     WHERE status = 'Aktif' ORDER BY name COLLATE NOCASE`,
  ).all() as ScheduleEmployee[];
}

export function groupScheduleEntries(entries: ScheduleEntry[]) {
  const grouped = new Map<string, { employee: ScheduleEmployee; statuses: Map<string, WorkLocation> }>();
  for (const entry of entries) {
    if (!grouped.has(entry.employeeNip)) {
      grouped.set(entry.employeeNip, {
        employee: { nip: entry.employeeNip, name: entry.employeeName, position: entry.position, unit: entry.unit },
        statuses: new Map(),
      });
    }
    grouped.get(entry.employeeNip)!.statuses.set(entry.fridayDate, entry.status);
  }
  return [...grouped.values()];
}
