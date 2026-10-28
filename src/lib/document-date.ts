const months: Record<string, number> = {
  januari: 1, jan: 1, january: 1, februari: 2, feb: 2, february: 2,
  maret: 3, mar: 3, march: 3, april: 4, apr: 4, mei: 5, may: 5,
  juni: 6, jun: 6, june: 6, juli: 7, jul: 7, july: 7,
  agustus: 8, agu: 8, agt: 8, ags: 8, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, october: 10, oct: 10,
  november: 11, nov: 11, desember: 12, des: 12, december: 12, dec: 12,
};

/** Normalize a complete document date without guessing missing year/day/month. */
export function normalizeDocumentDate(value: string) {
  const text = value.trim().toLocaleLowerCase("id-ID").replace(/^(?:tanggal|tgl\.?)\s*:?\s*/, "").replace(/\s+/g, " ");
  let day: number, month: number, year: string;
  const iso = /^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})$/.exec(text);
  const numeric = /^(\d{1,2})([-/.])(\d{1,2})\2(\d{4})$/.exec(text);
  const written = /^(\d{1,2})[ -]([a-z]+)\.?[ -](\d{4})$/.exec(text);
  if (iso) { year = iso[1]; month = Number(iso[3]); day = Number(iso[4]); }
  else if (numeric) { day = Number(numeric[1]); month = Number(numeric[3]); year = numeric[4]; }
  else if (written && months[written[2]]) { day = Number(written[1]); month = months[written[2]]; year = written[3]; }
  else return "";
  const result = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${result}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === result ? result : "";
}
