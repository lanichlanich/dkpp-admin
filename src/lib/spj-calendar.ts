// National holidays only; collective leave is separate from the requested calendar.
export const SPJ_HOLIDAY_SOURCES: Record<string, string> = {
  "2026": "https://www.kemenkopmk.go.id/node/5862",
  "2027": "https://www.kemenkopmk.go.id/node/6444",
};
export const SPJ_HOLIDAYS: Record<string, Record<string, string>> = {
  "2026": {
    "01-01": "Tahun Baru Masehi", "01-16": "Isra Mikraj Nabi Muhammad SAW", "02-17": "Tahun Baru Imlek",
    "03-19": "Hari Suci Nyepi", "03-21": "Idul Fitri", "03-22": "Idul Fitri",
    "04-03": "Wafat Yesus Kristus", "04-05": "Paskah", "05-01": "Hari Buruh Internasional",
    "05-14": "Kenaikan Yesus Kristus", "05-27": "Idul Adha", "05-31": "Hari Raya Waisak",
    "06-01": "Hari Lahir Pancasila", "06-16": "Tahun Baru Islam", "08-17": "Proklamasi Kemerdekaan",
    "08-25": "Maulid Nabi Muhammad SAW", "12-25": "Kelahiran Yesus Kristus",
  },
  "2027": {
    "01-01": "Tahun Baru Masehi", "01-05": "Isra Mikraj Nabi Muhammad SAW 1448 H", "02-06": "Tahun Baru Imlek",
    "03-08": "Hari Suci Nyepi", "03-10": "Idul Fitri", "03-11": "Idul Fitri",
    "03-26": "Wafat Yesus Kristus", "03-28": "Paskah", "05-01": "Hari Buruh Internasional",
    "05-06": "Kenaikan Yesus Kristus", "05-17": "Idul Adha", "05-20": "Hari Raya Waisak",
    "06-01": "Hari Lahir Pancasila", "06-06": "Tahun Baru Islam", "08-15": "Maulid Nabi Muhammad SAW",
    "08-17": "Proklamasi Kemerdekaan", "12-25": "Kelahiran Yesus Kristus", "12-26": "Isra Mikraj Nabi Muhammad SAW 1449 H",
  },
};
export type SpjDay = { date: string; day: number; weekday: number; holiday: string; state: "active" | "holiday" | "inactive" };
export type SpjDayRule = { dayMode: "quota" | "all"; activeDays: number; weekdays: number[] };
export function spjMonthDays(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("Bulan tidak valid.");
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
export function spjPeriodLabel(period: string) {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${period}-01T00:00:00Z`));
}
export function spjCalendar(period: string, rule: SpjDayRule, seed: string): SpjDay[] {
  const count = spjMonthDays(period), holidays = SPJ_HOLIDAYS[period.slice(0, 4)];
  if (!holidays) throw new Error("Kalender libur nasional untuk tahun ini belum tersedia. Pilih tahun 2026 atau 2027.");
  const days: SpjDay[] = Array.from({ length: count }, (_, index) => {
    const day = index + 1, date = `${period}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const national = holidays[date.slice(5)] ?? "";
    const holiday = national || (weekday === 0 ? "Minggu" : weekday === 6 ? "Sabtu" : "");
    return { date, day, weekday, holiday, state: holiday ? "holiday" : "inactive" };
  });
  const eligible = days.filter(day => !day.holiday && rule.weekdays.includes(day.weekday));
  const target = rule.dayMode === "all" ? eligible.length : rule.activeDays;
  if (target > eligible.length) throw new Error(`Tersedia ${eligible.length} hari yang memenuhi aturan, sedangkan jenis tenaga membutuhkan ${target} hari aktif. Ubah aturan hari aktif terlebih dahulu.`);
  // Seeded Fisher-Yates: preview and server generation agree; saved documents never reshuffle.
  let state = 2166136261;
  for (const char of `${period}:${seed}`) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  function random() { state = (state + 0x6D2B79F5) >>> 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  for (let i = eligible.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [eligible[i], eligible[j]] = [eligible[j], eligible[i]]; }
  for (const day of eligible.slice(0, target)) day.state = "active";
  return days;
}
