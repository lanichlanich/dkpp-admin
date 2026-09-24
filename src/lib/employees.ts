import "server-only";

import { cache } from "react";
import type { Employee } from "@/lib/db";
import { database as db } from "@/lib/database";
import { getBirthDateIsoFromNip, getRetirementAge, getRetirementTmt } from "@/lib/retirement-age";
import { requireUser } from "@/lib/session";

type EmployeeRow = {
  nip: string;
  name: string;
  parent_unit: string;
  unit: string;
  position: string;
  position_type: string;
  echelon: string;
  rank: string;
  asn_type: string;
  gender: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapEmployee(row: EmployeeRow): Employee {
  const genderDigit = row.nip.slice(-3, -2);
  const gender = genderDigit === "1" ? "Laki-laki" : genderDigit === "2" ? "Perempuan" : "Tidak diketahui";
  return {
    nip: row.nip,
    name: row.name,
    parentUnit: row.parent_unit,
    unit: row.unit,
    position: row.position,
    positionType: row.position_type,
    echelon: row.echelon,
    rank: row.rank,
    asnType: row.asn_type,
    gender,
    status: row.status,
    retirementAge: getRetirementAge({
      position: row.position,
      positionType: row.position_type,
      echelon: row.echelon,
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const getEmployees = cache(async () => {
  await requireUser();
  const rows = await db.prepare("SELECT * FROM employees ORDER BY name COLLATE NOCASE").all() as EmployeeRow[];
  return rows.map(mapEmployee);
});

export const getHukdisEmployees = cache(async (): Promise<Employee[]> => {
  await requireUser();
  const rows = await db.prepare(
    `SELECT *
     FROM employees
     WHERE status = 'Aktif'
     ORDER BY name COLLATE NOCASE`,
  ).all() as EmployeeRow[];
  return rows.map(mapEmployee);
});

export type KgbEmployeeOption = Pick<Employee, "nip" | "name" | "rank">;

export const getKgbEmployeeOptions = cache(async (): Promise<KgbEmployeeOption[]> => {
  await requireUser();
  return await db.prepare(
    `SELECT nip, name, rank
     FROM employees
     WHERE asn_type = 'PNS' AND status = 'Aktif'
     ORDER BY name COLLATE NOCASE`,
  ).all() as KgbEmployeeOption[];
});

export type DpcpEmployeeOption = Pick<Employee, "nip" | "name" | "rank" | "position">;

export type PakEmployeeOption = Pick<Employee, "nip" | "name" | "rank" | "position" | "status" | "unit" | "parentUnit" | "positionType">;
export const getPakEmployeeOptions = cache(async (): Promise<PakEmployeeOption[]> => {
  await requireUser();
  // Current position is not an eligibility filter: retired/transferred PNS may need a historical PAK.
  return await db.prepare(`SELECT nip, name, rank, position, status, unit, parent_unit AS parentUnit, position_type AS positionType FROM employees WHERE asn_type = 'PNS' AND status IN ('Aktif', 'Mutasi', 'Pensiun') ORDER BY name COLLATE NOCASE`).all() as PakEmployeeOption[];
});

export const getDpcpEmployeeOptions = cache(async (): Promise<DpcpEmployeeOption[]> => {
  await requireUser();
  return await db.prepare(
    `SELECT nip, name, rank, position
     FROM employees
     WHERE asn_type = 'PNS' AND status = 'Aktif'
     ORDER BY name COLLATE NOCASE`,
  ).all() as DpcpEmployeeOption[];
});

export type EmployeeOptions = {
  parentUnits: string[];
  units: string[];
  positions: string[];
  positionTypes: string[];
  echelons: string[];
  ranks: string[];
  asnTypes: string[];
  genders: string[];
  statuses: string[];
};

export const getEmployeeOptions = cache(async (): Promise<EmployeeOptions> => {
  const employees = await getEmployees();
  const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "id"));
  return {
    parentUnits: unique(employees.map((employee) => employee.parentUnit)),
    units: unique(employees.map((employee) => employee.unit)),
    positions: unique(employees.map((employee) => employee.position)),
    positionTypes: unique(employees.map((employee) => employee.positionType)),
    echelons: unique(employees.map((employee) => employee.echelon)),
    ranks: unique(employees.map((employee) => employee.rank)),
    asnTypes: unique(employees.map((employee) => employee.asnType)),
    genders: unique(employees.map((employee) => employee.gender)),
    statuses: unique(employees.map((employee) => employee.status)),
  };
});

export type EmployeeStatistics = {
  total: number;
  active: number;
  units: number;
  byPositionType: Array<{ positionType: string; total: number }>;
  byGender: Array<{ gender: string; total: number }>;
  byAsnType: Array<{ asnType: string; total: number }>;
};

export const getEmployeeStatistics = cache(async (): Promise<EmployeeStatistics> => {
  await requireUser();

  const summary = await db.prepare(
    `SELECT
      COUNT(*) AS total,
      COUNT(DISTINCT unit) AS units
     FROM employees
     WHERE status = 'Aktif'`,
  ).get() as { total: number; units: number };

  const byPositionType = await db.prepare(
    `SELECT
       CASE
         WHEN UPPER(TRIM(position_type)) = 'JS' THEN 'JS'
         WHEN UPPER(TRIM(position_type)) = 'JF' THEN 'JF'
         WHEN UPPER(TRIM(position_type)) = 'PELAKSANA' THEN 'Pelaksana'
         ELSE 'Lainnya'
       END AS "positionType",
       COUNT(*) AS total
     FROM employees
     WHERE status = 'Aktif'
     GROUP BY 1
     ORDER BY total DESC, "positionType"`,
  ).all() as Array<{ positionType: string; total: number }>;

  const byGender = await db.prepare(
    `SELECT CASE
       WHEN substr(nip, -3, 1) = '1' THEN 'Laki-laki'
       WHEN substr(nip, -3, 1) = '2' THEN 'Perempuan'
       ELSE 'Tidak diketahui'
     END AS gender, COUNT(*) AS total
     FROM employees
     WHERE status = 'Aktif'
     GROUP BY 1
     ORDER BY total DESC, gender`,
  ).all() as Array<{ gender: string; total: number }>;

  const byAsnType = await db.prepare(
    `SELECT asn_type AS "asnType", COUNT(*) AS total
     FROM employees
     WHERE status = 'Aktif'
     GROUP BY asn_type
     ORDER BY total DESC, "asnType"`,
  ).all() as Array<{ asnType: string; total: number }>;

  return {
    total: summary.total,
    active: summary.total,
    units: summary.units,
    byPositionType,
    byGender,
    byAsnType,
  };
});

export type UpcomingRetirement = {
  nip: string;
  name: string;
  unit: string;
  position: string;
  asnType: string;
  retirementAge: number;
  retirementTmt: string;
};

function toJakartaIsoDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addYearsToIsoDate(isoDate: string, years: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const targetYear = year + years;
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function addMonthsToIsoDate(isoDate: string, months: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const monthIndex = year * 12 + month - 1 + months;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12 + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function birthdayInYear(birthDate: string, year: number) {
  const [, month, day] = birthDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export const getUpcomingRetirements = cache(async (): Promise<UpcomingRetirement[]> => {
  await requireUser();

  const today = toJakartaIsoDate(new Date());
  const fiveYearsFromToday = addYearsToIsoDate(today, 5);
  const rows = await db.prepare(
    `SELECT nip, name, unit, position, position_type, echelon, asn_type
     FROM employees
     WHERE status = 'Aktif'`,
  ).all() as Array<Pick<EmployeeRow, "nip" | "name" | "unit" | "position" | "position_type" | "echelon" | "asn_type">>;

  return rows
    .map((row): UpcomingRetirement | null => {
      const retirementAge = getRetirementAge({
        position: row.position,
        positionType: row.position_type,
        echelon: row.echelon,
      });
      const retirementTmt = getRetirementTmt(row.nip, retirementAge);

      if (retirementAge === null || retirementTmt === null) return null;
      if (retirementTmt < today || retirementTmt > fiveYearsFromToday) return null;

      return {
        nip: row.nip,
        name: row.name,
        unit: row.unit,
        position: row.position,
        asnType: row.asn_type,
        retirementAge,
        retirementTmt,
      };
    })
    .filter((employee): employee is UpcomingRetirement => employee !== null)
    .sort((left, right) => (
      left.retirementTmt.localeCompare(right.retirementTmt)
      || left.name.localeCompare(right.name, "id")
    ));
});

export type UpcomingBirthday = {
  nip: string;
  name: string;
  unit: string;
  position: string;
  asnType: string;
  nextBirthday: string;
  turningAge: number;
  isToday: boolean;
};

export const getUpcomingBirthdays = cache(async (): Promise<UpcomingBirthday[]> => {
  await requireUser();

  const today = toJakartaIsoDate(new Date());
  const sixMonthsFromToday = addMonthsToIsoDate(today, 6);
  const currentYear = Number(today.slice(0, 4));
  const rows = await db.prepare(
    `SELECT nip, name, unit, position, asn_type
     FROM employees
     WHERE status = 'Aktif'`,
  ).all() as Array<Pick<EmployeeRow, "nip" | "name" | "unit" | "position" | "asn_type">>;

  return rows
    .map((row): UpcomingBirthday | null => {
      const birthDate = getBirthDateIsoFromNip(row.nip);
      if (!birthDate) return null;

      let nextBirthday = birthdayInYear(birthDate, currentYear);
      if (nextBirthday < today) nextBirthday = birthdayInYear(birthDate, currentYear + 1);
      if (nextBirthday > sixMonthsFromToday) return null;

      return {
        nip: row.nip,
        name: row.name,
        unit: row.unit,
        position: row.position,
        asnType: row.asn_type,
        nextBirthday,
        turningAge: Number(nextBirthday.slice(0, 4)) - Number(birthDate.slice(0, 4)),
        isToday: nextBirthday === today,
      };
    })
    .filter((employee): employee is UpcomingBirthday => employee !== null)
    .sort((left, right) => (
      left.nextBirthday.localeCompare(right.nextBirthday)
      || left.name.localeCompare(right.name, "id")
    ));
});
