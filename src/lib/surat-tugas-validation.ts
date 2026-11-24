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
export type TugasEmployee = { nip: string; name: string; rank: string; position: string };
export const TUGAS_SIGNER = "RORY FIRMANSYAH, S.STP, M.Si.";
export const TUGAS_TITLE = "Plt. Kepala Dinas Ketahanan Pangan dan Pertanian Kabupaten Indramayu,";
