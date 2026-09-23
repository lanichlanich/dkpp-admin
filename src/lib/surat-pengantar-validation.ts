import { z } from "zod";

const singleLineText = (label: string, max: number) => z
  .string()
  .trim()
  .min(1, `${label} wajib diisi.`)
  .max(max, `${label} terlalu panjang.`)
  .regex(/^[^<>\r\n]+$/, `${label} tidak boleh memuat tanda kurung sudut atau baris baru.`);

const isoDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal surat wajib diisi.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  }, "Tanggal surat tidak valid.");

export const suratPengantarSchema = z.object({
  tanggalSurat: isoDate,
  nomorSurat: singleLineText("Nomor surat", 120),
  nomorUrut: z.coerce.number().int().min(1, "Nomor urut minimal 1.").max(9_999, "Nomor urut terlalu besar."),
  fileYangDikirim: singleLineText("File yang dikirim", 500),
  jumlah: z.coerce.number().int().min(1, "Jumlah minimal 1.").max(9_999, "Jumlah terlalu besar."),
});

export type SuratPengantarInput = z.infer<typeof suratPengantarSchema>;
