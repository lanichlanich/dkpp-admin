import { z } from "zod";
import { validPltDate } from "@/lib/plt-dates";
import type { SpjDay, SpjDayRule } from "@/lib/spj-calendar";

const text = (max: number) => z.string().trim().max(max).refine(v => !/[\x00-\x1f<>]/.test(v), "Teks harus satu baris tanpa karakter khusus.");
export const spjTypeSchema = z.object({
  name: text(120).min(1, "Nama jenis tenaga wajib diisi."), dayMode: z.enum(["quota", "all"]),
  activeDays: z.number().int().min(1).max(31), dailyRate: z.number().int().min(0).max(1_000_000_000),
  weekdays: z.array(z.number().int().min(1).max(5)).min(1, "Pilih minimal satu hari kerja.").max(5).refine(v => new Set(v).size === v.length, "Hari kerja tidak boleh berulang."),
});
export const spjWorkerSchema = z.object({
  typeId: z.string().min(1).max(80), name: text(160).min(1, "Nama petugas wajib diisi."), bank: text(60),
  accountNumber: z.string().trim().regex(/^\d{0,40}$/, "Nomor rekening hanya boleh berisi angka."), isActive: z.boolean(),
});
export const spjVersionSchema = z.object({ updatedAt: z.string().min(1).max(50) });
export const spjDeleteSchema = spjVersionSchema.extend({ confirmed: z.literal(true) });
export const spjReportSchema = z.object({
  requestId: z.string().uuid(), typeId: z.string().min(1).max(80), typeUpdatedAt: z.string().min(1).max(50),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), seed: z.string().uuid(),
  documentDate: z.string().refine(validPltDate, "Tanggal dokumen tidak valid."),
  workers: z.array(z.object({ id: z.string().min(1).max(80), updatedAt: z.string().min(1).max(50) })).min(1).max(500),
  paNip: z.string().regex(/^\d{18}$/), paStatus: z.enum(["definitif", "plt"]),
  pptkNip: z.string().regex(/^\d{18}$/), treasurerNip: z.string().regex(/^\d{18}$/),
});
export type SpjType = z.infer<typeof spjTypeSchema> & { id: string; updatedAt: string };
export type SpjWorker = z.infer<typeof spjWorkerSchema> & { id: string; updatedAt: string };
export type SpjEmployee = { nip: string; name: string; position: string };
export type SpjSigners = { pa: SpjEmployee & { status: "definitif" | "plt" }; pptk: SpjEmployee; treasurer: SpjEmployee };
export type SpjSnapshot = {
  version: 1; period: string; typeName: string; rule: SpjDayRule; seed: string; documentDate: string;
  days: SpjDay[]; workers: Array<{ id: string; name: string; bank: string; accountNumber: string }>;
  dailyRate: number; activeCount: number; total: number; signers: SpjSigners;
};
export type SpjReport = { id: string; typeName: string; period: string; activeCount: number; workerCount: number; total: number; createdAt: string };
export type SpjReportPage = { items: SpjReport[]; total: number; page: number; pageSize: number; totalPages: number; search: string };
export type SpjOptions = { types: SpjType[]; workers: SpjWorker[]; employees: SpjEmployee[]; defaults: { paNip: string; paStatus: "definitif" | "plt"; pptkNip: string; treasurerNip: string }; reports: SpjReportPage };
