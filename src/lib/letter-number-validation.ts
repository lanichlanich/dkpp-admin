import { z } from "zod";
import { getLetterClassification, splitLetterNumber } from "@/lib/letter-classification";

export const letterNumberSchema = z.string().trim().min(1, "Pilih kode klasifikasi dan isi nomor surat.")
  .max(120, "Nomor surat maksimal 120 karakter.")
  .regex(/^[^<>\x00-\x1f{}]+$/, "Nomor surat harus satu baris tanpa tanda kurung sudut/kurawal.")
  .superRefine((value, ctx) => {
    const { code, body } = splitLetterNumber(value);
    if (!getLetterClassification(code)) ctx.addIssue({ code: "custom", message: "Pilih kode klasifikasi yang tercantum dalam Perbup Indramayu Nomor 17 Tahun 2023." });
    if (!/^\d/.test(body.trim())) ctx.addIssue({ code: "custom", message: "Isi nomor urut surat, diikuti kode unit/tahun bila diperlukan." });
  });
