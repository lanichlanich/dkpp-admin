import { z } from "zod";

const requiredText = (label: string, max = 180) => z.string().trim().min(1, `${label} wajib diisi.`).max(max, `${label} terlalu panjang.`);
const optionalText = (max = 180) => z.string().trim().max(max, "Isian terlalu panjang.");
const isoDate = (label: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} wajib diisi.`);
const optionalDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid.")]);

export const dpcpSchema = z.object({
  nip: z.string().regex(/^\d{18}$/, "Pilih pegawai PNS aktif."),
  bup: requiredText("BUP", 40),
  tempatLahir: requiredText("Tempat lahir", 100),
  gaji: z.coerce.number().int().positive("Gaji pokok wajib lebih dari 0.").max(100_000_000),
  mkg: requiredText("Masa kerja golongan", 80),
  mkp: requiredText("Masa kerja pensiun", 80),
  mksp: optionalText(80),
  pendidikan1: requiredText("Pendidikan pertama", 120),
  tmtpns: isoDate("TMT PNS"),
  namaPasangan: optionalText(160),
  tglPasangan: optionalDate,
  tglNikah: optionalDate,
  pasanganKe: optionalText(20),
  namaAnak1: optionalText(160),
  tglAnak1: optionalDate,
  statusAnak1: optionalText(80),
  orangTuaAnak1: optionalText(160),
  namaAnak2: optionalText(160),
  tglAnak2: optionalDate,
  statusAnak2: optionalText(80),
  orangTuaAnak2: optionalText(160),
  alamatPensiun: requiredText("Alamat sesudah pensiun", 300),
  tglDpcp: isoDate("Tanggal DPCP"),
});

export type DpcpInput = z.infer<typeof dpcpSchema>;
