import { database as db } from "@/lib/database";
import { generateOfficialStatementDocument, formatOfficialNip } from "@/lib/official-statement-document";
import { saveOfficialStatementDocument } from "@/lib/official-statement-documents";
import { officialStatementSchema, officialStatementTypeLabels } from "@/lib/official-statement-validation";
import { formatIndonesianDate } from "@/lib/kgb";
import { createNotification } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Data permintaan tidak valid." }, { status: 400 });
  }

  const result = officialStatementSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { message: "Periksa kembali isian yang ditandai.", errors: result.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const input = result.data;
  const employee = await db.prepare(
    `SELECT nip, name, rank, position
     FROM employees
     WHERE nip = ? AND asn_type = 'PNS' AND status = 'Aktif'`,
  ).get(input.nip) as { nip: string; name: string; rank: string; position: string } | undefined;
  if (!employee) {
    return Response.json({ message: "Pegawai PNS aktif tidak ditemukan.", errors: { nip: ["Pilih pegawai PNS aktif yang valid."] } }, { status: 422 });
  }

  const label = officialStatementTypeLabels[input.documentType];
  try {
    const document = await generateOfficialStatementDocument(input.documentType, {
      no_surat: input.nomorSurat,
      nama_pegawai: employee.name,
      nip_pegawai: formatOfficialNip(employee.nip),
      pangkat_gol_pegawai: employee.rank,
      jabatan_pegawai: employee.position,
      tgl_surat: formatIndonesianDate(input.tanggalSurat),
    });
    const saved = await saveOfficialStatementDocument({
      userId: user.id,
      documentType: input.documentType,
      employeeNip: employee.nip,
      employeeName: employee.name,
      nomorSurat: input.nomorSurat,
      tanggalSurat: input.tanggalSurat,
      document,
    });
    await createNotification(user.id, "success", `${label} dibuat`, `${label} untuk ${employee.name} berhasil dibuat dan disimpan.`);
    return new Response(new Uint8Array(document), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${saved.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Official statement generation failed", error);
    await createNotification(user.id, "error", `${label} gagal dibuat`, "Dokumen gagal diproses.");
    return Response.json({ message: `${label} gagal dibuat. Silakan coba kembali.` }, { status: 500 });
  }
}
