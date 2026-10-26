import { z } from "zod";

const singleLine = (label: string, max: number) => z.string().trim()
  .min(1, `${label} wajib diisi.`).max(max, `${label} maksimal ${max} karakter.`)
  .regex(/^[^<>\x00-\x1f{}]+$/, `${label} harus satu baris tanpa tanda kurung sudut atau kurawal.`);

export const suratPerbantuanSchema = z.object({
  employeeNip: z.string().regex(/^\d{18}$/, "Pilih pegawai dari daftar."),
  nomorSurat: z.string().trim().min(1, "Nomor urut surat wajib diisi.").max(30, "Nomor urut maksimal 30 karakter.")
    .regex(/^\d[\dA-Za-z.-]*$/, "Isi nomor urut saja, misalnya 1234 atau 1234.a."),
  tanggalSurat: z.iso.date("Tanggal surat tidak valid."),
  jabatanPerbantuan: singleLine("Jabatan perbantuan", 180),
  unitKerjaPerbantuan: singleLine("Unit kerja perbantuan", 240),
});

export type SuratPerbantuanInput = z.infer<typeof suratPerbantuanSchema>;
export type SuratPerbantuanEmployee = {
  nip: string;
  name: string;
  rank: string;
  position: string;
  unit: string;
  asnType: string;
};

// Employee records store both PNS (III/a) and PPPK (IX) grades before the rank.
export function perbantuanRank(value: string) {
  const parts = value.split(/\s+\/\s+/).map((part) => part.trim())
    .filter((part) => part && !/^(null|undefined|-)$/i.test(part));
  const grade = parts.find((part) => /^(?:[IVX]+(?:\/[a-e])?|\d+)$/i.test(part));
  return { pangkat: parts.filter((part) => part !== grade).join(" / ") || "-", golongan: grade || "-" };
}
