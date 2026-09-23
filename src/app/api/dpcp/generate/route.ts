import { database as db } from "@/lib/database";
import { generateDpcpDocument } from "@/lib/dpcp-document";
import { saveDpcpDocument } from "@/lib/dpcp-documents";
import { dpcpSchema } from "@/lib/dpcp-validation";
import { birthDateFromNip, formatIndonesianDate, formatRupiah } from "@/lib/kgb";
import { createNotification } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

type EmployeeRow = { nip: string; name: string; position: string; rank: string };

function splitRank(value: string) {
  const [grade = "", ...rankParts] = value.split(/\s+\/\s+/);
  return {
    golongan: grade.toLowerCase() === "null" ? "" : grade.trim(),
    pangkat: rankParts.join(" / ").toLowerCase() === "null" ? "" : rankParts.join(" / ").trim(),
  };
}

function optionalDate(value: string) {
  return value ? formatIndonesianDate(value) : "";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Data permintaan tidak valid." }, { status: 400 });
  }

  const result = dpcpSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ message: "Periksa kembali isian yang ditandai.", errors: result.error.flatten().fieldErrors }, { status: 422 });
  }

  const employee = await db.prepare(
    `SELECT nip, name, position, rank FROM employees
     WHERE nip = ? AND asn_type = 'PNS' AND status = 'Aktif'`,
  ).get(result.data.nip) as EmployeeRow | undefined;
  if (!employee) return Response.json({ message: "Pegawai PNS aktif tidak ditemukan." }, { status: 422 });

  const head = await db.prepare(
    `SELECT nip, name, position, rank FROM employees
     WHERE status = 'Aktif' AND position LIKE 'KEPALA DINAS%'
     ORDER BY name COLLATE NOCASE LIMIT 1`,
  ).get() as EmployeeRow | undefined;
  if (!head) return Response.json({ message: "Data Kepala Dinas aktif tidak ditemukan." }, { status: 422 });

  const input = result.data;
  const rank = splitRank(employee.rank);
  try {
    const document = await generateDpcpDocument({
      bup: input.bup,
      nama_pegawai: employee.name,
      nip_pegawai: employee.nip,
      ttl: `${input.tempatLahir}, ${birthDateFromNip(employee.nip)}`,
      jabatan: employee.position,
      pangkat: rank.pangkat,
      golongan: rank.golongan,
      gaji: formatRupiah(input.gaji),
      mkg: input.mkg,
      mkp: input.mkp,
      mksp: input.mksp || "-",
      pendidikan1: input.pendidikan1,
      tmtpns: formatIndonesianDate(input.tmtpns),
      "nama_s/i": input.namaPasangan,
      "tgl_s/i": optionalDate(input.tglPasangan),
      tgl_nikah: optionalDate(input.tglNikah),
      "s/i_ke": input.pasanganKe,
      nama_anak1: input.namaAnak1,
      tgl_anak1: optionalDate(input.tglAnak1),
      status_anak1: input.statusAnak1,
      "anak1_ayah/ibu": input.orangTuaAnak1,
      nama_anak2: input.namaAnak2,
      tgl_anak2: optionalDate(input.tglAnak2),
      status_anak2: input.statusAnak2,
      "anak2_ayah/ibu": input.orangTuaAnak2,
      alamat_pensiun: input.alamatPensiun,
      tgl_dpcp: formatIndonesianDate(input.tglDpcp),
      nama_kadis: head.name,
      nip_kadis: head.nip,
    });

    const savedDocument = await saveDpcpDocument({
      userId: user.id,
      employeeNip: employee.nip,
      employeeName: employee.name,
      tglDpcp: input.tglDpcp,
      document,
    });
    await createNotification(user.id, "success", "DPCP dibuat", `Dokumen DPCP ${employee.name} berhasil dibuat dan disimpan ke daftar dokumen.`);
    return new Response(new Uint8Array(document), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${savedDocument.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("DPCP document generation failed", error);
    await createNotification(user.id, "error", "DPCP gagal dibuat", `Dokumen DPCP ${employee.name} gagal diproses.`);
    return Response.json({ message: "Dokumen DPCP gagal dibuat. Silakan coba kembali." }, { status: 500 });
  }
}
