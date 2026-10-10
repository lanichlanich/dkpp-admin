import { z } from "zod";

export const KAK_SECTIONS = [
  ["latarBelakang", "Latar Belakang", "Jelaskan dari konteks umum ke kebutuhan spesifik sub kegiatan dan risiko yang akan diatasi."],
  ["dasarHukum", "Dasar Hukum Tugas Fungsi/Kebijakan", "Pilih peraturan yang relevan dari katalog referensi Renstra/Renja. Jangan menambahkan keterangan acuan perencanaan dalam bagian dasar hukum."],
  ["gambaranUmum", "Gambaran Umum", "Jelaskan lingkup kegiatan, keluaran dan volumenya serta keterkaitan dengan program/kegiatan dalam RKA."],
  ["maksudTujuan", "Maksud dan Tujuan", "Ringkas keluaran, manfaat dan dampak yang diharapkan; jangan mengarang visi/misi atau angka kinerja."],
  ["maksud", "Maksud", "Jelaskan maksud operasional sub kegiatan."],
  ["tujuan", "Tujuan", "Jelaskan tujuan kualitatif, hasil yang diharapkan dan manfaat jangka pendek/panjang."],
  ["strategiPelaksanaan", "Cara Pelaksanaan Kegiatan/Strategi Pelaksanaan", "Susun usulan strategi sesuai jenis belanja dan keluaran RKA."],
  ["metodePelaksanaan", "Metode Pelaksanaan", "Susun usulan metode pelaksanaan; jangan memastikan metode pengadaan, penyedia atau jumlah petugas yang tidak tercantum."],
  ["tahapanPelaksanaan", "Tahapan Kegiatan/Rencana Tahapan Pelaksanaan", "Usulkan tahap persiapan, pelaksanaan, pengendalian serta pelaporan sebagai rencana, bukan kegiatan selesai."],
  ["tempatPelaksanaan", "Tempat Pelaksanaan", "Gunakan lokasi RKA tanpa mengarang alamat spesifik."],
  ["pelaksanaPenanggungJawab", "Pelaksana dan Penanggung Jawab Kegiatan", "Uraikan peran pelaksana, PA/KPA, PPTK dan penerima manfaat tanpa mengarang penetapan jabatan atau nama."],
  ["pelaksanaSubKegiatan", "Pelaksana Sub Kegiatan", "Uraikan usulan peran SDM sesuai kegiatan. Jumlah dan nama pelaksana yang tidak ada perlu penetapan."],
  ["penanggungJawab", "Penanggung Jawab Kegiatan", "Jelaskan tanggung jawab PA/KPA sesuai penetapan dan koordinasi PPTK; jangan menyamakan penandatangan RKA dengan PPTK."],
  ["penerimaManfaat", "Penerima Manfaat", "Gunakan kelompok sasaran RKA; jangan mengarang jumlah penerima manfaat."],
  ["jadwalRencana", "Jadwal Rencana", "Susun usulan tahapan dalam rentang waktu RKA, bedakan usulan pembagian waktu dari jadwal yang sudah ditetapkan."],
  ["waktuPelaksanaan", "Waktu Pelaksanaan", "Gunakan rentang waktu dan tahun anggaran dalam RKA."],
  ["totalBiaya", "Total Biaya Yang Diperlukan", "Gunakan pagu tahun anggaran utama, bukan alokasi tahun sebelumnya/berikutnya. Sertakan sumber dana dan rincian belanja."],
  ["identifikasiRisiko", "Identifikasi Risiko", "Ringkas usulan risiko keterlambatan, ketidaksesuaian spesifikasi dan administrasi, sesuai jenis kegiatan. Tabel risiko diisi terpisah."],
  ["penutup", "Penutup", "Nyatakan KAK sebagai acuan pelaksanaan yang efektif, efisien, akuntabel dan transparan."],
] as const;

export type KakSectionKey = (typeof KAK_SECTIONS)[number][0];
const text = (max = 1000) => z.string().trim().max(max).regex(/^[^<>\x00-\x08\x0b\x0c\x0e-\x1f]*$/, "Teks dokumen tidak valid.");
const money = z.string().regex(/^\d{1,15}(?:\.\d{1,2})?$/, "Nilai anggaran harus berupa angka rupiah.");

export const kakDraftSchema = z.object({
  metadata: z.object({
    tahunAnggaran: z.number().int().min(2000).max(2100),
    perangkatDaerah: text(500).min(1), urusanPemerintahan: text(500), bidangUrusan: text(500),
    program: text(500), kegiatan: text(500), subKegiatan: text(500).min(1), kodeSubKegiatan: text(80),
    sumberDana: text(300), lokasi: text(500), waktuPelaksanaan: text(200), kelompokSasaran: text(500),
    keluaran: text(500), targetKeluaran: text(200), paguAnggaran: money,
    penandatanganNama: text(160), penandatanganNip: z.string().regex(/^(?:\d{18})?$/), penandatanganJabatan: text(300),
    penandatanganPangkat: text(150).optional(), hasil: text(500).optional(), targetHasil: text(200).optional(), sistemPengadaan: text(200).optional(),
    rincianRekening: z.array(z.object({ kode: text(80), uraian: text(300).min(1), jumlah: money })).max(100).optional(),
    rincianAnggaran: z.array(z.object({ uraian: text(300).min(1), volume: text(100), jumlah: money })).max(100),
  }),
  sections: z.object(Object.fromEntries(KAK_SECTIONS.map(([key]) => [key, text(3500).min(1)])) as Record<KakSectionKey, ReturnType<typeof text>>),
  risks: z.array(z.object({ risiko: text(250).min(1), penyebab: text(250).min(1), mitigasi: text(350).min(1) })).length(3),
  warnings: z.array(text(600).min(1)).max(30),
});
export type KakDraft = z.infer<typeof kakDraftSchema>;
export const kakMetadataSchema = kakDraftSchema.shape.metadata;
export type KakReference = { id: string; title: string; sha256: string; locators: string[] };
export type ReferencedKakDraft = KakDraft & { references: KakReference[]; legalBasisIds: string[] };

export function formatKakRupiah(value: string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2 }).format(Number(value));
}

export type KakHistory = {
  id: string; tahunAnggaran: number; subKegiatan: string; kodeSubKegiatan: string;
  paguAnggaran: string; fileName: string; sourceName: string; createdAt: string; createdBy: string; warnings: string[];
  references?: KakReference[];
  nomorUrutSubKegiatan?: string;
  nomorUrutReference?: KakReference;
  poFileName?: string;
  bundleFileName?: string;
};
