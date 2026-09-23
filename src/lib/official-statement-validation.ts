import { z } from "zod";

const isoDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal surat wajib diisi.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  }, "Tanggal surat tidak valid.");

export const officialStatementSchema = z.object({
  documentType: z.enum(["hukdis", "hukda"], { message: "Jenis surat wajib dipilih." }),
  nip: z.string().regex(/^\d{18}$/, "Pilih pegawai PNS aktif yang valid."),
  nomorSurat: z.string()
    .trim()
    .min(1, "Nomor surat wajib diisi.")
    .max(120, "Nomor surat terlalu panjang.")
    .regex(/^[^<>\r\n]+$/, "Nomor surat tidak boleh memuat tanda kurung sudut atau baris baru."),
  tanggalSurat: isoDate,
});

export type OfficialStatementInput = z.infer<typeof officialStatementSchema>;
export type OfficialStatementType = OfficialStatementInput["documentType"];

export const officialStatementTypeLabels: Record<OfficialStatementType, string> = {
  hukdis: "Surat HUKDIS",
  hukda: "Surat HUKDA",
};
