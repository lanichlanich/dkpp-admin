import { z } from "zod";
import { pakLevels, pakPredicates } from "@/lib/pak";

const text = (max: number) => z.string().trim().min(1, "Wajib diisi.").max(max, `Maksimal ${max} karakter.`).regex(/^[^<>\x00-\x1f{}]+$/, "Gunakan teks satu baris tanpa tanda kurung kurawal/sudut.");
const date = z.iso.date("Tanggal tidak valid.").refine((v) => v >= "1900-01-01" && v <= "2100-12-31", "Tanggal di luar rentang 1900–2100.");
const credit = z.number().finite().min(0).max(99999).refine((v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 0.00001, "Maksimal tiga angka desimal.");
const period = z.object({
  year: z.number().int().min(1900).max(2100),
  startMonth: z.number().int().min(1).max(12),
  endMonth: z.number().int().min(1).max(12),
  level: z.enum(Object.keys(pakLevels) as [keyof typeof pakLevels, ...Array<keyof typeof pakLevels>]),
  predicate: z.enum(Object.keys(pakPredicates) as [keyof typeof pakPredicates, ...Array<keyof typeof pakPredicates>]),
});
const component = z.object({ old: credit, new: credit, note: z.string().trim().max(80).regex(/^[^<>\x00-\x1f{}]*$/) });
export const pakSchema = z.object({
  nip: z.string().regex(/^\d{18}$/, "Pilih pegawai PNS."),
  nomor: text(100), tanggal: date, tempatPenetapan: text(50), instansi: text(100),
  kartuAsn: text(40), tempatLahir: text(60), tanggalLahir: date, jenisKelamin: z.enum(["Pria", "Wanita"]),
  pangkat: text(80), golongan: z.enum(["I/a", "I/b", "I/c", "I/d", "II/a", "II/b", "II/c", "II/d", "III/a", "III/b", "III/c", "III/d", "IV/a", "IV/b", "IV/c", "IV/d", "IV/e"]),
  tmtPangkat: date, jabatan: text(140), tmtJabatan: date, unitKerja: text(150),
  penilaiNama: text(100), penilaiNip: z.string().regex(/^\d{18}$/, "NIP penilai harus 18 digit."),
  period,
  history: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("integrasi"), year: z.number().int().min(1900).max(2100), credit }),
    period.extend({ kind: z.literal("konversi") }),
  ])).max(24, "Maksimal 24 baris riwayat."),
  components: z.object({ dasar: component, jfLama: component, penyesuaian: component, pendidikan: component, lainnya: component }),
  rankMinimum: credit.refine((n) => n > 0, "Kebutuhan AK pangkat harus lebih dari nol."),
  levelMinimum: credit.refine((n) => n > 0).nullable(),
}).superRefine((value, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const currentStart = value.period.year * 12 + value.period.startMonth;
  const currentEndDate = new Date(Date.UTC(value.period.year, value.period.endMonth, 0)).toISOString().slice(0, 10);
  if (value.period.endMonth < value.period.startMonth) issue(["period", "endMonth"], "Bulan akhir harus setelah atau sama dengan bulan awal.");
  if (value.tanggal < currentEndDate) issue(["tanggal"], "Tanggal penetapan tidak boleh sebelum akhir periode penilaian.");
  if (value.tmtJabatan.slice(0, 7) > `${value.period.year}-${String(value.period.startMonth).padStart(2, "0")}`) issue(["period", "startMonth"], "Bulan awal tidak boleh mendahului bulan TMT jabatan yang dinilai.");
  for (const key of ["tmtPangkat", "tmtJabatan"] as const) {
    if (value[key] > currentEndDate) issue([key], "TMT tidak boleh melewati akhir periode penilaian.");
    if (value[key] <= value.tanggalLahir) issue([key], "TMT harus setelah tanggal lahir.");
  }
  if (!value.jabatan.toLowerCase().includes(value.period.level.toLowerCase())) issue(["jabatan"], "Jabatan pada periode penilaian harus memuat jenjang yang dipilih.");
  const integration = value.history.filter((row) => row.kind === "integrasi");
  if (integration.length > 1) issue(["history"], "Gunakan satu saldo AK integrasi agar tidak terhitung ganda.");
  const spans: Array<[number, number]> = [];
  value.history.forEach((row, index) => {
    if (row.kind === "integrasi") {
      if (row.year >= value.period.year) issue(["history", index, "year"], "Tahun saldo integrasi harus sebelum tahun penilaian.");
      return;
    }
    const start = row.year * 12 + row.startMonth;
    const end = row.year * 12 + row.endMonth;
    if (end < start) issue(["history", index, "endMonth"], "Bulan akhir riwayat tidak valid.");
    if (end >= currentStart) issue(["history", index], "Riwayat harus berakhir sebelum periode PAK baru.");
    if (integration.some((item) => row.year <= item.year)) issue(["history", index], "Konversi riwayat harus setelah tahun saldo integrasi.");
    if (spans.some(([a, b]) => start <= b && end >= a)) issue(["history", index], "Periode riwayat saling tumpang tindih.");
    spans.push([start, end]);
  });
});
export type PakInput = z.infer<typeof pakSchema>;
