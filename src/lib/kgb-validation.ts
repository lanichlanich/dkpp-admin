import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal wajib diisi.");

export const kgbSchema = z.object({
  nomorSurat: z.string().trim().regex(/^\d+$/, "Nomor surat hanya boleh berisi angka.").max(20),
  tglSurat: isoDate,
  nip: z.string().regex(/^\d{18}$/, "Pilih pegawai PNS yang valid."),
  gajiLama: z.coerce.number().int().positive("Gaji lama wajib lebih dari 0.").max(100_000_000),
  pejabatKgbLama: z.string().trim().min(3, "Pejabat KGB lama wajib diisi.").max(150),
  nomorKgbLama: z.string().trim().min(1, "Nomor SK KGB lama wajib diisi.").max(100),
  tglKgbLama: isoDate,
  tmtKgbLama: isoDate,
  mkgTahunLama: z.coerce.number().int().min(0).max(32),
  mkgBulanLama: z.coerce.number().int().min(0).max(12),
  mkgTahunBaru: z.coerce.number().int().min(0).max(32),
  mkgBulanBaru: z.coerce.number().int().min(0).max(12),
  tmtKgbBaru: isoDate,
});

export type KgbInput = z.infer<typeof kgbSchema>;
