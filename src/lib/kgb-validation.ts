import { DEFAULT_SIGNATORY, signatorySchema } from "@/lib/signatory";
import { z } from "zod";
import { letterNumberSchema } from "@/lib/letter-number-validation";
import { validPltDate } from "@/lib/plt-dates";

const isoDate = z.string().refine(validPltDate, "Tanggal harus berupa tanggal kalender yang valid.");
const integer = (min: number, max: number) => z.preprocess(value => typeof value === "number" || (typeof value === "string" && value.trim()) ? value : undefined, z.coerce.number().int().min(min).max(max));

export const kgbSchema = z.object({
  signatory: signatorySchema.default(DEFAULT_SIGNATORY),
  nomorSurat: letterNumberSchema,
  tglSurat: isoDate,
  nip: z.string().regex(/^\d{18}$/, "Pilih pegawai PNS yang valid."),
  gajiLama: integer(1, 100_000_000),
  pejabatKgbLama: z.string().trim().min(3, "Pejabat KGB lama wajib diisi.").max(150),
  nomorKgbLama: z.string().trim().min(1, "Nomor SK KGB lama wajib diisi.").max(100),
  tglKgbLama: isoDate,
  tmtKgbLama: isoDate,
  mkgTahunLama: integer(0, 32),
  mkgBulanLama: integer(0, 12),
  mkgTahunBaru: integer(0, 32),
  mkgBulanBaru: integer(0, 12),
  tmtKgbBaru: isoDate,
});

export type KgbInput = z.infer<typeof kgbSchema>;
