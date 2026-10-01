import { extractGrade, salaryForRankAndYears } from "@/lib/kgb";

export function parseDpcpService(value: string) {
  const match = /^(\d{1,2})\s*(?:tahun|thn|th)(?:\s*(\d{1,2})\s*(?:bulan|bln|bl))?$/i.exec(value.trim());
  if (!match) return null;
  const years = Number(match[1]);
  const months = Number(match[2] ?? 0);
  return years <= 65 && months < 12 ? { years, months } : null;
}

export function dpcpSalary(rank: string, service: string) {
  const duration = parseDpcpService(service);
  const grade = extractGrade(rank);
  if (!duration || !grade) return null;
  // Gaji berhenti pada masa kerja maksimum tabel, bukan naik tanpa batas.
  const maximum = grade.startsWith("I/") ? 27 : 32;
  return salaryForRankAndYears(rank, Math.min(duration.years, maximum));
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function dpcpRetirementDate(nip: string, bup: string) {
  const age = Number.parseInt(bup, 10);
  const birth = validDate(`${nip.slice(0, 4)}-${nip.slice(4, 6)}-${nip.slice(6, 8)}`);
  if (!birth || ![58, 60, 65].includes(age)) return "";
  return new Date(Date.UTC(birth.getUTCFullYear() + age, birth.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

export function dpcpPensionService(tmtPns: string, tmtPensiun: string) {
  const start = validDate(tmtPns);
  const end = validDate(tmtPensiun);
  if (!start || !end || start > end) return "";
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  return `${Math.floor(months / 12)} Tahun ${months % 12} Bulan`;
}

export function dpcpParents(employeeName: string, spouseName: string) {
  return [employeeName.trim(), spouseName.trim()].filter(Boolean).join(" / ");
}
