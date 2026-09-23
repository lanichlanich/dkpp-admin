import salaryData from "@/data/pns-salary-2024.json";

export type KgbEmployee = { nip: string; name: string; rank: string };

const INDONESIAN_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function formatIndonesianDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const [, year, month, day] = match;
  const monthName = INDONESIAN_MONTHS[Number(month) - 1];
  if (!monthName || Number(day) < 1 || Number(day) > 31) return "";
  return `${day} ${monthName} ${year}`;
}

export function birthDateFromNip(nip: string) {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(nip.replace(/\D/g, ""));
  if (!match) return "";
  return formatIndonesianDate(`${match[1]}-${match[2]}-${match[3]}`);
}

export function addYearsToDate(value: string, years: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const targetYear = Number(match[1]) + years;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function formatRupiah(value: number) {
  if (!Number.isFinite(value)) return "";
  return `Rp${Math.round(value).toLocaleString("id-ID")},00`;
}

function spellNumber(value: number): string {
  const words = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  if (value < 12) return words[value];
  if (value < 20) return `${spellNumber(value - 10)} belas`;
  if (value < 100) return `${spellNumber(Math.floor(value / 10))} puluh ${spellNumber(value % 10)}`.trim();
  if (value < 200) return `seratus ${spellNumber(value - 100)}`.trim();
  if (value < 1_000) return `${spellNumber(Math.floor(value / 100))} ratus ${spellNumber(value % 100)}`.trim();
  if (value < 2_000) return `seribu ${spellNumber(value - 1_000)}`.trim();
  if (value < 1_000_000) return `${spellNumber(Math.floor(value / 1_000))} ribu ${spellNumber(value % 1_000)}`.trim();
  if (value < 1_000_000_000) return `${spellNumber(Math.floor(value / 1_000_000))} juta ${spellNumber(value % 1_000_000)}`.trim();
  if (value < 1_000_000_000_000) return `${spellNumber(Math.floor(value / 1_000_000_000))} miliar ${spellNumber(value % 1_000_000_000)}`.trim();
  return `${spellNumber(Math.floor(value / 1_000_000_000_000))} triliun ${spellNumber(value % 1_000_000_000_000)}`.trim();
}

export function terbilangRupiah(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) return "";
  if (value === 0) return "nol rupiah";
  return `${spellNumber(value).replace(/\s+/g, " ")} rupiah`;
}

export function extractGrade(rank: string) {
  const match = /\b(IV|III|II|I)\s*\/\s*([a-e])\b/i.exec(rank);
  return match ? `${match[1].toUpperCase()}/${match[2].toLowerCase()}` : null;
}

export function salaryForRankAndYears(rank: string, years: number) {
  const grade = extractGrade(rank);
  if (!grade) return null;
  const salaries = salaryData.salaries as Record<string, Record<string, number>>;
  return salaries[grade]?.[String(years)] ?? null;
}
