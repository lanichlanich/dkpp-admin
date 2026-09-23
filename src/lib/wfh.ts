export const WFH_TEMPLATE_YEAR = 2026;

export const WFH_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export type WfhMonth = (typeof WFH_MONTHS)[number];

export function monthFromIsoDate(value: string): WfhMonth | null {
  const match = /^\d{4}-(\d{2})-\d{2}$/.exec(value);
  if (!match) return null;
  return WFH_MONTHS[Number(match[1]) - 1] ?? null;
}
