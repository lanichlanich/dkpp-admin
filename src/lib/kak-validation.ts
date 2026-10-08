import { z } from "zod";
import { signatorySchema } from "@/lib/signatory";
import type { KakReference } from "@/lib/kak-types";

export const kakOptionsSchema = z.object({
  tanggalDokumen: z.iso.date(),
  nomorUrutSubKegiatan: z.string().trim().max(32).regex(/^[^<>\x00-\x1f]*$/, "Nomor urut sub kegiatan tidak valid.").optional(),
  pptkNama: z.string().trim().max(160).regex(/^[^<>\x00-\x1f]*$/).default(""),
  pptkNip: z.string().regex(/^(?:\d{18})?$/, "NIP PPTK harus 18 digit atau kosong.").default(""),
  signatory: signatorySchema.optional(),
}).refine((value) => !value.pptkNip || value.pptkNama, { path: ["pptkNama"], message: "Isi nama PPTK jika mengisi NIP." });

export type KakOptions = z.infer<typeof kakOptionsSchema> & { nomorUrutReference?: KakReference };
