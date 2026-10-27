import { z } from "zod";

const DAY = 86_400_000;
export const PLT_REMINDER_DAYS = 14;

export function jakartaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function validPltDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > "2199-09-30") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function nextPltDay(value: string) {
  return new Date(new Date(`${value}T00:00:00Z`).getTime() + DAY).toISOString().slice(0, 10);
}

// Three calendar months, inclusive of the start date. Clamp month-end first.
export function pltEndDate(start: string) {
  if (!validPltDate(start)) return "";
  const [year, month, day] = start.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month + 3, 0)).getUTCDate();
  const nextStart = Date.UTC(year, month + 2, Math.min(day, lastDay));
  return new Date(nextStart - DAY).toISOString().slice(0, 10);
}

export function pltDateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00Z`));
}

const line = (label: string) => z.string().trim().min(1, `${label} wajib diisi.`).max(200, `${label} maksimal 200 karakter.`)
  .refine(value => !/[\r\n\x00-\x1f]/.test(value), `${label} harus satu baris.`).transform(value => value.replace(/\s+/g, " "));
export const pltSchema = z.object({
  employeeNip: z.string().regex(/^\d{18}$/, "Pilih pegawai yang terdaftar."),
  actingPosition: line("Jabatan Plt."),
  actingUnit: line("Unit kerja Plt."),
  skNumber: line("Nomor SK / surat tugas"),
  startDate: z.string().refine(validPltDate, "Tanggal mulai tidak valid."),
  notes: z.string().trim().max(1000, "Catatan maksimal 1.000 karakter."),
  previousId: z.union([z.string().uuid(), z.literal("")]).optional(),
});
export type PltInput = z.infer<typeof pltSchema>;
export type PltEmployee = { nip: string; name: string; position: string; unit: string };
export type PltAssignment = PltInput & { id: string; employeeName: string; endDate: string; closedAt: string | null; hasNext: boolean; nextStartDate: string | null; fileName: string | null; fileSize: number | null };
export type PltStatus = "upcoming" | "active" | "expiring" | "expired" | "renewed" | "closed";
export const PLT_STATUS_LABELS: Record<PltStatus, string> = {
  upcoming: "Belum mulai", active: "Aktif", expiring: "Segera berakhir", expired: "Habis", renewed: "Diperpanjang", closed: "Selesai",
};
export function pltStatus(row: PltAssignment, today: string): { status: PltStatus; days: number } {
  const days = Math.round((Date.parse(`${row.endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  const status = row.closedAt ? "closed" : row.nextStartDate && row.nextStartDate <= today ? "renewed" : row.startDate > today ? "upcoming" : days < 0 ? "expired" : days <= PLT_REMINDER_DAYS ? "expiring" : "active";
  return { status, days };
}

export function pltTimeLabel(row: PltAssignment, today: string) {
  const { status, days } = pltStatus(row, today);
  if (status === "closed") return "Ditandai selesai";
  if (status === "renewed") return row.nextStartDate ? `Digantikan mulai ${pltDateLabel(row.nextStartDate)}` : "Dilanjutkan ke periode berikutnya";
  if (status === "upcoming") return `Mulai ${pltDateLabel(row.startDate)}`;
  if (days < 0) return `Lewat ${Math.abs(days)} hari`;
  return days === 0 ? "Berakhir hari ini" : `Sisa ${days} hari`;
}
