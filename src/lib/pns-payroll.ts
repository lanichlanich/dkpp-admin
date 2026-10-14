import salaryData from "@/data/pns-salary-2024.json";

const salaries: Record<string, Record<string, number>> = salaryData.salaries;
export const PNS_GRADES = Object.keys(salaries);
export const STRUCTURAL_ALLOWANCES: Record<string, number> = {
  "I A": 5_500_000, "I B": 4_375_000, "II A": 3_250_000, "II B": 2_025_000,
  "III A": 1_260_000, "III B": 980_000, "IV A": 540_000, "IV B": 490_000, "V A": 360_000,
};
const GENERAL_ALLOWANCES: Record<string, number> = { I: 175_000, II: 180_000, III: 185_000, IV: 190_000 };
export const KORPRI_DEDUCTION = 100_000;
export const BPJS_BASE_CAP = 12_000_000;
export const RICE_PER_PERSON = 72_420;
export type PayrollExtra = { name: string; amount: number; bpjsBase?: boolean };
export type PnsPayrollInput = {
  grade: string; years: number; months: number; spouse: boolean; children: number;
  riceInCash: boolean; job: "umum" | "struktural" | "fungsional" | "tanpa";
  echelon: string; functionalAllowance: number; professionalAllowance: number;
  mealDays: number; mealRate: number; allowances: PayrollExtra[];
  bpjsBaseOverride: number | null; additionalBpjsMembers: number;
  tapera: number; cashTax: number; rounding: number; korpri: boolean; deductions: PayrollExtra[];
};
export const DEFAULT_PNS_PAYROLL: PnsPayrollInput = {
  grade: "III/a", years: 0, months: 0, spouse: false, children: 0, riceInCash: true,
  job: "umum", echelon: "IV A", functionalAllowance: 0, professionalAllowance: 0,
  mealDays: 0, mealRate: 0, allowances: [], bpjsBaseOverride: null, additionalBpjsMembers: 0,
  tapera: 0, cashTax: 0, rounding: 0, korpri: false, deductions: [],
};
export type PayrollLine = { name: string; amount: number; explanation: string };
export function salaryYears(grade: string) {
  return Object.keys(salaries[grade] ?? {}).map(Number).sort((a, b) => a - b);
}
function integer(value: number, label: string, max = 1_000_000_000) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`${label} harus berupa bilangan bulat antara 0 dan ${max.toLocaleString("id-ID")}.`);
}
function extras(items: PayrollExtra[], label: string) {
  if (items.length > 30) throw new Error(`Maksimal 30 ${label}.`);
  for (const item of items) {
    integer(item.amount, label);
    if (item.amount && !item.name.trim()) throw new Error(`Isi nama ${label} yang memiliki nominal.`);
    if (label === "tunjangan tambahan" && /\b(tpp|tukin)\b|tunjangan\s+kinerja|tambahan\s+penghasilan/i.test(item.name)) throw new Error("TPP/tukin tidak termasuk dalam simulasi ini.");
  }
}
export function calculatePnsPayroll(input: PnsPayrollInput) {
  integer(input.years, "Masa kerja golongan", 33);
  integer(input.months, "Bulan masa kerja", 11);
  integer(input.children, "Anak yang ditanggung", 2);
  integer(input.mealDays, "Hari uang makan", 31);
  integer(input.additionalBpjsMembers, "Anggota BPJS tambahan", 10);
  for (const [key, label] of Object.entries({ functionalAllowance: "Tunjangan fungsional", professionalAllowance: "Tunjangan profesi", mealRate: "Tarif uang makan", tapera: "Tapera", cashTax: "PPh 21 yang dipotong", rounding: "Pembulatan slip" })) integer(input[key as "functionalAllowance"], label);
  if (input.bpjsBaseOverride !== null) {
    integer(input.bpjsBaseOverride, "Dasar BPJS sesuai slip");
    if (input.bpjsBaseOverride === 0) throw new Error("Dasar BPJS sesuai slip harus lebih besar dari nol, atau kosongkan untuk perhitungan otomatis.");
  }
  extras(input.allowances, "tunjangan tambahan"); extras(input.deductions, "potongan tambahan");
  const basic = salaries[input.grade]?.[String(input.years)];
  if (!basic) throw new Error("Golongan dan masa kerja tidak tersedia pada tabel PP No. 5 Tahun 2024.");
  if (!["umum", "struktural", "fungsional", "tanpa"].includes(input.job)) throw new Error("Pilih jenis tunjangan jabatan yang valid.");
  const spouse = input.spouse ? Math.round(basic * 10 / 100) : 0;
  const children = Math.round(basic * 2 * input.children / 100);
  const familyBase = basic + spouse + children;
  const people = 1 + Number(input.spouse) + input.children;
  const rice = input.riceInCash ? people * RICE_PER_PERSON : 0;
  const job = input.job === "umum" ? GENERAL_ALLOWANCES[input.grade.split("/")[0]]
    : input.job === "struktural" ? STRUCTURAL_ALLOWANCES[input.echelon]
      : input.job === "fungsional" ? input.functionalAllowance : 0;
  if (job === undefined) throw new Error("Pilih eselon yang valid.");
  const calculatedBpjsBase = familyBase + job + input.professionalAllowance + input.allowances.filter(row => row.bpjsBase).reduce((sum, row) => sum + row.amount, 0);
  const bpjsBase = Math.min(input.bpjsBaseOverride ?? calculatedBpjsBase, BPJS_BASE_CAP);
  const bpjs = Math.round(bpjsBase / 100);
  const pension = Math.round(familyBase * 475 / 10_000);
  // Split a rounded combined IWP to avoid a one-rupiah double-rounding discrepancy.
  const tht = Math.round(familyBase * 8 / 100) - pension;
  const income: PayrollLine[] = [
    { name: "Gaji pokok", amount: basic, explanation: `${input.grade} · MKG ${input.years} tahun ${input.months} bulan · PP No. 5 Tahun 2024` },
    { name: "Tunjangan istri/suami", amount: spouse, explanation: "10% gaji pokok jika menjadi tanggungan" },
    { name: "Tunjangan anak", amount: children, explanation: `${input.children} anak × 2% gaji pokok` },
    { name: "Tunjangan beras", amount: rice, explanation: input.riceInCash ? `${people} jiwa × 10 kg × Rp7.242` : "Diberikan natura/tidak dibayar tunai" },
    { name: input.job === "umum" ? "Tunjangan umum" : input.job === "struktural" ? "Tunjangan struktural" : input.job === "fungsional" ? "Tunjangan fungsional" : "Tunjangan jabatan", amount: job, explanation: input.job === "struktural" ? `Eselon ${input.echelon} · Perpres No. 26 Tahun 2007` : input.job === "umum" ? "Perpres No. 12 Tahun 2006" : "Sesuai hak/SK jabatan pegawai" },
    { name: "Tunjangan profesi", amount: input.professionalAllowance, explanation: "Nominal sesuai hak/SK profesi" },
    { name: "Uang makan", amount: input.mealDays * input.mealRate, explanation: `${input.mealDays} hari × Rp${input.mealRate.toLocaleString("id-ID")} · sesuai ketentuan instansi` },
    ...input.allowances.filter(row => row.amount).map(row => ({ name: row.name.trim(), amount: row.amount, explanation: "Tunjangan tambahan sesuai kondisi pegawai" })),
    { name: "Pembulatan sesuai slip", amount: input.rounding, explanation: "Penyesuaian manual jika diperlukan" },
  ];
  const deductions: PayrollLine[] = [
    { name: "Iuran pensiun", amount: pension, explanation: "4,75% gaji pokok + tunjangan keluarga" },
    { name: "Tabungan Hari Tua (THT)", amount: tht, explanation: "3,25% gaji pokok + tunjangan keluarga; total IWP 8%" },
    { name: "BPJS Kesehatan pegawai", amount: bpjs, explanation: `1% dasar BPJS Rp${bpjsBase.toLocaleString("id-ID")} (batas Rp12 juta)` },
    { name: "BPJS keluarga tambahan", amount: bpjs * input.additionalBpjsMembers, explanation: `${input.additionalBpjsMembers} peserta tambahan × 1% dasar BPJS` },
    { name: "Tapera", amount: input.tapera, explanation: "Sesuai nominal potongan pada slip, jika berlaku" },
    { name: "PPh 21 yang dibebankan pegawai", amount: input.cashTax, explanation: "Isian sesuai slip; PPh 21 gaji rutin DTP tidak mengurangi hasil bersih" },
    { name: "KORPRI (opsional)", amount: input.korpri ? KORPRI_DEDUCTION : 0, explanation: input.korpri ? "Diaktifkan · Rp100.000 per bulan" : "Tidak diaktifkan" },
    ...input.deductions.filter(row => row.amount).map(row => ({ name: row.name.trim(), amount: row.amount, explanation: "Potongan tambahan sesuai slip" })),
  ];
  const gross = income.reduce((sum, row) => sum + row.amount, 0);
  const totalDeductions = deductions.reduce((sum, row) => sum + row.amount, 0);
  return { basic, familyBase, calculatedBpjsBase, bpjsBase, income, deductions, gross, totalDeductions, net: gross - totalDeductions };
}
