import { z } from "zod";
import { EMPLOYEE_DOCUMENT_TYPES, SKP_ASSESSMENT_VALUES, SKP_PREDICATE_VALUES, employeeDocumentIsSkp, employeeDocumentNeedsServicePeriod } from "@/lib/employee-document-types";

const singleLine = z.string().trim().max(200, "Isian maksimal 200 karakter.")
  .regex(/^[^\r\n\u0000-\u001f]*$/, "Isian harus satu baris.");

export const employeeDocumentIdentitySchema = z.object({
  namaDokumen: singleLine.min(1, "Nama dokumen wajib diisi.").optional(),
  nomorSurat: singleLine,
});

const date = z.string().trim().refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Tanggal tidak valid.");

export const employeeDocumentEditSchema = z.object({
  documentType: z.enum(EMPLOYEE_DOCUMENT_TYPES),
  namaDokumen: singleLine.min(1, "Nama dokumen wajib diisi."),
  nomorSurat: singleLine,
  tglSurat: z.string().trim().default(""),
  tmtSurat: z.string().trim().default(""),
  masaKerja: z.string().trim().max(100).default(""),
  tahun: z.string().trim().default(""),
  penilaianKinerja: z.string().default(""),
  penilaianPerilaku: z.string().default(""),
  predikatSkp: z.string().default(""),
}).superRefine((value, ctx) => {
  const error = (field: keyof typeof value, message: string) => ctx.addIssue({ code: "custom", path: [field], message });
  if (employeeDocumentIsSkp(value.documentType)) {
    if (!/^\d{4}$/.test(value.tahun) || Number(value.tahun) < 1900 || Number(value.tahun) > 2100) error("tahun", "Tahun harus antara 1900 dan 2100.");
    if (!z.enum(SKP_ASSESSMENT_VALUES).safeParse(value.penilaianKinerja).success) error("penilaianKinerja", "Pilih penilaian kinerja.");
    if (!z.enum(SKP_ASSESSMENT_VALUES).safeParse(value.penilaianPerilaku).success) error("penilaianPerilaku", "Pilih penilaian perilaku.");
    if (!z.enum(SKP_PREDICATE_VALUES).safeParse(value.predikatSkp).success) error("predikatSkp", "Pilih predikat SKP.");
  } else {
    if (!value.nomorSurat) error("nomorSurat", "Nomor dokumen wajib diisi.");
    if (!date.safeParse(value.tglSurat).success) error("tglSurat", "Tanggal tidak valid.");
    if (!date.safeParse(value.tmtSurat).success) error("tmtSurat", "Tanggal tidak valid.");
    if (employeeDocumentNeedsServicePeriod(value.documentType) && !value.masaKerja) error("masaKerja", "Masa kerja wajib diisi.");
  }
});
