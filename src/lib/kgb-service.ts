import "server-only";
import { database as db } from "@/lib/database";
import { generateKgbDocument } from "@/lib/kgb-document";
import { addYearsToDate, birthDateFromNip, formatIndonesianDate, formatRupiah, salaryForRankAndYears, terbilangRupiah } from "@/lib/kgb";
import type { KgbInput } from "@/lib/kgb-validation";

export class KgbArchiveError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}

export async function buildKgbDocument(input: KgbInput) {
  const employee = await db.prepare("SELECT nip, name, rank, asn_type, status FROM employees WHERE nip = ?")
    .get<{ nip: string; name: string; rank: string; asn_type: string; status: string }>(input.nip);
  if (!employee || employee.asn_type !== "PNS" || employee.status !== "Aktif") throw new KgbArchiveError("Pegawai PNS aktif tidak ditemukan.");
  const gajiBaru = salaryForRankAndYears(employee.rank, input.mkgTahunBaru);
  if (gajiBaru === null) throw new KgbArchiveError(`Masa kerja ${input.mkgTahunBaru} tahun tidak tersedia untuk ${employee.rank}.`);
  const tmtDepan = input.mkgTahunBaru === 32 ? "" : addYearsToDate(input.tmtKgbBaru, 2);
  const document = await generateKgbDocument({
    nomor_surat: input.nomorSurat, tgl_surat: formatIndonesianDate(input.tglSurat), nama_pegawai: employee.name,
    nip: employee.nip, tgl_lahir: birthDateFromNip(employee.nip), pangkat_gol: employee.rank,
    gaji_lama: formatRupiah(input.gajiLama), terbilang_gaji_lama: terbilangRupiah(input.gajiLama),
    pejabat_kgb_lama: input.pejabatKgbLama, nomor_kgb_lama: input.nomorKgbLama,
    tgl_kgb_lama: formatIndonesianDate(input.tglKgbLama), tmt_kgb_lama: formatIndonesianDate(input.tmtKgbLama),
    mkg_tahun_lama: input.mkgTahunLama, mkg_bulan_lama: input.mkgBulanLama,
    mkg_tahun_baru: input.mkgTahunBaru, mkg_bulan_baru: input.mkgBulanBaru,
    gaji_baru: formatRupiah(gajiBaru), terbilang_gaji_baru: terbilangRupiah(gajiBaru),
    tmt_kgb_baru: formatIndonesianDate(input.tmtKgbBaru), tmt_kgb_depan: tmtDepan ? formatIndonesianDate(tmtDepan) : "",
  }, input.signatory);
  return { employee, document };
}
