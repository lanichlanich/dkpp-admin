import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { formatIndonesianDate } from "@/lib/kgb";
import { calculatePak, convertCredit, formatCredit, pakComponentLabels, pakLevels, pakPredicates, periodLabel, roundCredit, type PakComponent } from "@/lib/pak";
import type { PakInput } from "@/lib/pak-validation";

export async function generatePakDocument(input: PakInput, employeeName: string) {
  const calculation = calculatePak(input);
  const period = input.period;
  const months = period.endMonth - period.startMonth + 1;
  const signed = (value: number | null) => value === null ? "-" : `${value > 0 ? "+" : ""}${formatCredit(value)}`;
  const history = [...input.history].sort((a, b) => a.year - b.year || (a.kind === "integrasi" ? 0 : a.startMonth) - (b.kind === "integrasi" ? 0 : b.startMonth));
  const data: Record<string, unknown> = {
    nama: employeeName, nip: input.nip, kartu_asn: input.kartuAsn,
    ttl: `${input.tempatLahir}, ${formatIndonesianDate(input.tanggalLahir)}`,
    jenis_kelamin: input.jenisKelamin,
    pangkat_tmt: `${input.pangkat} / ${input.golongan} / ${formatIndonesianDate(input.tmtPangkat)}`,
    jabatan_tmt: `${input.jabatan} / ${formatIndonesianDate(input.tmtJabatan)}`,
    unit_kerja: input.unitKerja, instansi: input.instansi,
    nomor: input.nomor, tanggal: formatIndonesianDate(input.tanggal), tempat: input.tempatPenetapan,
    penilai_nama: input.penilaiNama, penilai_nip: input.penilaiNip,
    periode_penilaian: `${periodLabel(period)} ${period.year}`,
    predikat: period.predicate, persentase: `${pakPredicates[period.predicate]} %`, koefisien: formatCredit(pakLevels[period.level].coefficient),
    rumus: months === 12 ? "(Kolom 2 x kolom 3)" : `(${months}/12 x kolom 2 x kolom 3)`,
    ak_lama: formatCredit(calculation.oldConversion), ak_baru: formatCredit(calculation.newConversion), ak_konversi_total: formatCredit(calculation.conversionTotal),
    total_lama: formatCredit(calculation.oldTotal), total_baru: formatCredit(calculation.newTotal), total: formatCredit(calculation.total),
    minimal_pangkat: formatCredit(input.rankMinimum), minimal_jenjang: input.levelMinimum === null ? "-" : formatCredit(input.levelMinimum),
    selisih_pangkat: signed(calculation.rankDifference), selisih_jenjang: signed(calculation.levelDifference),
    riwayat: [...history, { ...period, kind: "konversi" as const }].map((row) => row.kind === "integrasi" ? {
      tahun: row.year, periode: "AK Integrasi", predikat: "-", persentase: "-", koefisien: "-", ak: formatCredit(row.credit),
    } : {
      tahun: row.year, periode: periodLabel(row), predikat: row.predicate.toUpperCase(), persentase: `${pakPredicates[row.predicate]} %`, koefisien: formatCredit(pakLevels[row.level].coefficient), ak: formatCredit(convertCredit(row)),
    }),
  };
  for (const key of Object.keys(pakComponentLabels) as PakComponent[]) {
    const row = input.components[key];
    data[`${key}_lama`] = row.old ? formatCredit(row.old) : "-";
    data[`${key}_baru`] = row.new ? formatCredit(row.new) : "-";
    data[`${key}_jumlah`] = row.old + row.new ? formatCredit(roundCredit(row.old + row.new)) : "-";
    data[`${key}_catatan`] = row.note || "-";
  }
  const template = await readFile(path.join(process.cwd(), "src/templates/template-pak.docx"));
  const document = new Docxtemplater(new PizZip(template), { paragraphLoop: true, linebreaks: true, nullGetter: () => { throw new Error("Isian template PAK tidak lengkap."); } });
  document.render(data);
  return document.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}
