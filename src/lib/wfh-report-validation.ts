import { z } from "zod";

const text = (max: number) => z.string().trim().min(1, "Wajib diisi.").max(max).refine((v) => !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(v), "Karakter tidak valid.");
export const reportContextSchema = z.object({
  nip: z.string().regex(/^\d{18}$/, "Pilih pegawai."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v && v >= "2000-01-01" && v <= "2100-12-31";
  }, "Tanggal tidak valid."),
});
export const reportOutputTypeSchema = z.enum(["laporan", "kegiatan", "dokumen"]);
export const reportTaskSchema = z.object({
  start: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  activity: text(300),
  output: text(240),
  outputQuantity: z.number().int().min(1).max(999).default(1),
  outputType: reportOutputTypeSchema.default("laporan"),
  status: z.number().int().min(0).max(100).default(100),
});
export const wfhReportSchema = reportContextSchema.extend({
  rank: text(100),
  tasks: z.array(reportTaskSchema).length(4, "Isi empat kegiatan sesuai template."),
  reviewed: z.literal(true, { error: "Periksa dan konfirmasi isi laporan terlebih dahulu." }),
}).superRefine((v, ctx) => {
  v.tasks.forEach((task, i) => {
    if (task.start >= task.end || (i > 0 && task.start < v.tasks[i - 1].end)) {
      ctx.addIssue({ code: "custom", path: ["tasks", i, "start"], message: "Waktu harus berurutan dan tidak tumpang tindih." });
    }
  });
});
export const aiTasksSchema = z.object({ tasks: z.array(z.object({ activity: text(300), targetOutput: text(240) })).length(4) });
export type WfhReportInput = z.infer<typeof wfhReportSchema>;
export type WfhReportTask = z.infer<typeof reportTaskSchema>;
export type ReportOutputType = z.infer<typeof reportOutputTypeSchema>;
export type ReportEmployee = { nip: string; name: string; rank: string; position: string; unit: string };
