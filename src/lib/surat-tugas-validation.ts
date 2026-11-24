import { z } from "zod";

const line = (max: number) => z.string().trim().min(1, "Isian wajib diisi.").max(max, `Maksimal ${max} karakter.`).regex(/^[^\x00-\x1f\x7f]+$/, "Gunakan satu baris per butir.");
export const suratTugasSchema = z.object({
  nomor: line(100), tanggal: z.iso.date("Tanggal surat tidak sah."), tempat: line(80),
  dasar: z.array(line(400)).min(1).max(8), tugas: z.array(line(600)).min(1).max(10),
  employeeNips: z.array(z.string().regex(/^\d{18}$/)).min(1, "Pilih minimal satu pegawai.").max(20)
    .refine(items => new Set(items).size === items.length, "Pegawai tidak boleh berulang."),
  confirmSigner: z.boolean().refine(value => value, "Konfirmasi penandatangan sebelum mengunduh."),
});
export type SuratTugasInput = z.infer<typeof suratTugasSchema>;
export type TugasEmployee = { nip: string; name: string; rank: string; position: string; unit?: string };
export const TUGAS_SIGNER = "RORY FIRMANSYAH, S.STP, M.Si.";
export const TUGAS_TITLE = "Plt. Kepala Dinas Ketahanan Pangan dan Pertanian Kabupaten Indramayu";

export const suratTugasAiInput = z.object({
  dasar: z.string().trim().max(1600),
  tugas: z.string().trim().min(8, "Isi konteks penugasan minimal 8 karakter.").max(2400),
}).strict().refine(value => !Object.values(value).some(text => /(?:[0-9][\s.-]*){16,}/.test(text)), "Hapus NIP atau rangkaian nomor identitas dari catatan AI.");

export const suratTugasAiResult = z.object({
  dasar: z.array(line(400)).max(8),
  tugas: z.array(line(600)).min(1).max(10),
}).strict();
export type SuratTugasAiResult = z.infer<typeof suratTugasAiResult>;
