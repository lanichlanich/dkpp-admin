import { z } from "zod";
import { monthFromIsoDate, WFH_MONTHS, WFH_TEMPLATE_YEAR } from "@/lib/wfh";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal surat wajib diisi.");

export const wfhSchema = z.object({
  nomorSurat: z
    .string()
    .trim()
    .min(1, "Nomor surat wajib diisi.")
    .max(120, "Nomor surat terlalu panjang.")
    .regex(/^[^<>\r\n]+$/, "Nomor surat tidak boleh memuat tanda kurung sudut atau baris baru."),
  bulanWfh: z.enum(WFH_MONTHS, { error: "Pilih bulan WFH." }),
  tanggalSurat: isoDate,
}).superRefine((input, context) => {
  const [year, month, day] = input.tanggalSurat.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isValidDate = date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;

  if (!isValidDate) {
    context.addIssue({ code: "custom", path: ["tanggalSurat"], message: "Tanggal surat tidak valid." });
    return;
  }
  if (year !== WFH_TEMPLATE_YEAR) {
    context.addIssue({
      code: "custom",
      path: ["tanggalSurat"],
      message: `Template surat menetapkan tahun ${WFH_TEMPLATE_YEAR}.`,
    });
  }
  if (monthFromIsoDate(input.tanggalSurat) !== input.bulanWfh) {
    context.addIssue({
      code: "custom",
      path: ["tanggalSurat"],
      message: "Bulan pada tanggal surat harus sama dengan bulan WFH.",
    });
  }
});

export type WfhInput = z.infer<typeof wfhSchema>;
