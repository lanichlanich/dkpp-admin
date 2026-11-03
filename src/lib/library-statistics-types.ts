import { z } from "zod";

export const libraryPeriodSchema = z.string().regex(/^(19\d{2}|20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/, "Pilih periode bulan yang valid.");
export type LibrarySnapshot = {
  bookEntries: number; activeBooks: number; totalCopies: number; availableCopies: number;
  registeredVisitors: number; activeVisitors: number; employeeVisitors: number;
  openLoans: number; borrowedCopies: number; overdueLoans: number;
};
export type LibraryPeriodTotals = { visits: number; uniqueVisitors: number; loans: number; loanCopies: number; returns: number; returnCopies: number };
export type LibraryMonthStatistics = { month: string; label: string; visits: number; loans: number; returns: number };
export type LibraryCategoryStatistics = { category: string; entries: number; copies: number };
export type LibraryPopularBook = { id: string; inventoryCode: string; title: string; loans: number; copies: number };
export type LibraryStatistics = {
  today: string; period: string; periodLabel: string; snapshot: LibrarySnapshot;
  activity: LibraryPeriodTotals; months: LibraryMonthStatistics[];
  categories: LibraryCategoryStatistics[]; popularBooks: LibraryPopularBook[];
};
export function libraryPeriodWindow(input: unknown) {
  const period = libraryPeriodSchema.parse(input), [year, month] = period.split("-").map(Number);
  const date = (offset: number) => new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 10);
  return { period, start: `${period}-01`, end: date(1), trendStart: date(-11), months: Array.from({ length: 12 }, (_, i) => date(i - 11).slice(0, 7)) };
}
export function libraryMonthLabel(month: string, short = false) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", month: short ? "short" : "long", year: short ? "2-digit" : "numeric" }).format(new Date(`${month}-01T00:00:00Z`));
}
