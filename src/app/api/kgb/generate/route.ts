import { database as db } from "@/lib/database";
import { generateKgbDocument } from "@/lib/kgb-document";
import { saveKgbDocument } from "@/lib/kgb-documents";
import {
  addYearsToDate,
  birthDateFromNip,
  formatIndonesianDate,
  formatRupiah,
  salaryForRankAndYears,
  terbilangRupiah,
} from "@/lib/kgb";
import { kgbSchema } from "@/lib/kgb-validation";
import { createNotification } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

type EmployeeRow = { nip: string; name: string; rank: string; asn_type: string; status: string };

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Data permintaan tidak valid." }, { status: 400 });
  }

  const result = kgbSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { message: "Periksa kembali isian yang ditandai.", errors: result.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const input = result.data;
  const employee = await db.prepare(
    "SELECT nip, name, rank, asn_type, status FROM employees WHERE nip = ?",
  ).get(input.nip) as EmployeeRow | undefined;
  if (!employee || employee.asn_type !== "PNS" || employee.status !== "Aktif") {
    return Response.json({ message: "Pegawai PNS aktif tidak ditemukan." }, { status: 422 });
  }

  const gajiBaru = salaryForRankAndYears(employee.rank, input.mkgTahunBaru);
  if (gajiBaru === null) {
    return Response.json(
      { message: `Masa kerja ${input.mkgTahunBaru} tahun tidak tersedia untuk ${employee.rank}.` },
      { status: 422 },
    );
  }

  try {
    const tmtDepan = input.mkgTahunBaru === 32 ? "" : addYearsToDate(input.tmtKgbBaru, 2);
    const output = await generateKgbDocument({
      nomor_surat: input.nomorSurat,
      tgl_surat: formatIndonesianDate(input.tglSurat),
      nama_pegawai: employee.name,
      nip: employee.nip,
      tgl_lahir: birthDateFromNip(employee.nip),
      pangkat_gol: employee.rank,
      gaji_lama: formatRupiah(input.gajiLama),
      terbilang_gaji_lama: terbilangRupiah(input.gajiLama),
      pejabat_kgb_lama: input.pejabatKgbLama,
      nomor_kgb_lama: input.nomorKgbLama,
      tgl_kgb_lama: formatIndonesianDate(input.tglKgbLama),
      tmt_kgb_lama: formatIndonesianDate(input.tmtKgbLama),
      mkg_tahun_lama: input.mkgTahunLama,
      mkg_bulan_lama: input.mkgBulanLama,
      mkg_tahun_baru: input.mkgTahunBaru,
      mkg_bulan_baru: input.mkgBulanBaru,
      gaji_baru: formatRupiah(gajiBaru),
      terbilang_gaji_baru: terbilangRupiah(gajiBaru),
      tmt_kgb_baru: formatIndonesianDate(input.tmtKgbBaru),
      tmt_kgb_depan: tmtDepan ? formatIndonesianDate(tmtDepan) : "",
    });

    const savedDocument = await saveKgbDocument({
      userId: user.id,
      employeeNip: employee.nip,
      employeeName: employee.name,
      nomorSurat: input.nomorSurat,
      tglSurat: input.tglSurat,
      document: output,
    });
    await createNotification(user.id, "success", "SK KGB dibuat", `Dokumen SK KGB ${employee.name} berhasil dibuat dan disimpan ke histori.`);
    return new Response(new Uint8Array(output), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${savedDocument.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("KGB document generation failed", error);
    await createNotification(user.id, "error", "SK KGB gagal dibuat", `Dokumen untuk ${employee.name} gagal diproses.`);
    return Response.json({ message: "Dokumen gagal dibuat. Silakan coba kembali." }, { status: 500 });
  }
}
