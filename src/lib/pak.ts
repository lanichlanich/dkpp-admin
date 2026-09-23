// PerBKN 3/2023 Pasal 13; PermenPANRB 1/2023 Lampiran koefisien tahunan.
export const pakLevels = {
  "Ahli Pertama": { coefficient: 12.5, rankMinimum: 50, levelMinimum: 100 },
  "Ahli Muda": { coefficient: 25, rankMinimum: 100, levelMinimum: 200 },
  "Ahli Madya": { coefficient: 37.5, rankMinimum: 150, levelMinimum: 450 },
  "Ahli Utama": { coefficient: 50, rankMinimum: 200, levelMinimum: null },
  Pemula: { coefficient: 3.75, rankMinimum: 15, levelMinimum: 15 },
  Terampil: { coefficient: 5, rankMinimum: 20, levelMinimum: 60 },
  Mahir: { coefficient: 12.5, rankMinimum: 50, levelMinimum: 100 },
  Penyelia: { coefficient: 25, rankMinimum: 100, levelMinimum: null },
} as const;
export type PakLevel = keyof typeof pakLevels;
export const pakPredicates = { "Sangat Baik": 150, Baik: 100, "Cukup/Butuh Perbaikan": 75, Kurang: 50, "Sangat Kurang": 25 } as const;
export type PakPredicate = keyof typeof pakPredicates;
export const pakMonths = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const pakComponentLabels = { dasar: "AK Dasar", jfLama: "AK JF lama", penyesuaian: "AK Penyesuaian/Penyetaraan", pendidikan: "AK Peningkatan Pendidikan", lainnya: "Lainnya" } as const;
export type PakComponent = keyof typeof pakComponentLabels;
export type PakPeriod = { year: number; startMonth: number; endMonth: number; level: PakLevel; predicate: PakPredicate };
export type PakHistory = (PakPeriod & { kind: "konversi" }) | { kind: "integrasi"; year: number; credit: number };
export type PakCredits = Record<PakComponent, { old: number; new: number; note: string }>;
export const roundCredit = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;
export function formatCredit(value: number) { return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value); }
export function periodLabel(period: Pick<PakPeriod, "startMonth" | "endMonth">) {
  return period.startMonth === period.endMonth ? pakMonths[period.startMonth - 1] : `${pakMonths[period.startMonth - 1]} - ${pakMonths[period.endMonth - 1]}`;
}
export function convertCredit(period: PakPeriod) {
  return roundCredit((period.endMonth - period.startMonth + 1) * pakPredicates[period.predicate] * pakLevels[period.level].coefficient / 1200);
}
export function calculatePak(input: { period: PakPeriod; history: PakHistory[]; components: PakCredits; rankMinimum: number; levelMinimum: number | null }) {
  // Sum already-rounded rows in thousandths so the printed columns reconcile exactly.
  const oldConversion = input.history.reduce((sum, row) => sum + Math.round((row.kind === "integrasi" ? row.credit : convertCredit(row)) * 1000), 0) / 1000;
  const newConversion = convertCredit(input.period);
  const conversionTotal = roundCredit(oldConversion + newConversion);
  const oldTotal = roundCredit(oldConversion + Object.values(input.components).reduce((sum, row) => sum + row.old, 0));
  const newTotal = roundCredit(newConversion + Object.values(input.components).reduce((sum, row) => sum + row.new, 0));
  const total = roundCredit(oldTotal + newTotal);
  return { oldConversion, newConversion, conversionTotal, oldTotal, newTotal, total, rankDifference: roundCredit(total - input.rankMinimum), levelDifference: input.levelMinimum === null ? null : roundCredit(total - input.levelMinimum) };
}
export function inferPakLevel(position: string): PakLevel | "" {
  return (Object.keys(pakLevels) as PakLevel[]).find((level) => position.toLowerCase().includes(level.toLowerCase())) ?? "";
}
export function emptyPakComponents(): PakCredits {
  return Object.fromEntries(Object.keys(pakComponentLabels).map((key) => [key, { old: 0, new: 0, note: "" }])) as PakCredits;
}
