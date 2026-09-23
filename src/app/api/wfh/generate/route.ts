import { formatIndonesianDate } from "@/lib/kgb";
import { createNotification } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";
import { generateWfhDocument } from "@/lib/wfh-document";
import { saveWfhDocument } from "@/lib/wfh-documents";
import { wfhSchema } from "@/lib/wfh-validation";

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

  const result = wfhSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { message: "Periksa kembali isian yang ditandai.", errors: result.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const input = result.data;
  try {
    const document = await generateWfhDocument({
      "800.1.11.1/2677/Sekre": input.nomorSurat,
      Agustus: input.bulanWfh,
      "04 Agustus 2026": formatIndonesianDate(input.tanggalSurat),
    });
    const savedDocument = await saveWfhDocument({
      userId: user.id,
      nomorSurat: input.nomorSurat,
      bulanWfh: input.bulanWfh,
      tanggalSurat: input.tanggalSurat,
      document,
    });
    createNotification(
      user.id,
      "success",
      "Surat tugas WFH dibuat",
      `Surat tugas WFH bulan ${input.bulanWfh} berhasil dibuat dan disimpan ke daftar dokumen.`,
    );
    return new Response(new Uint8Array(document), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${savedDocument.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("WFH document generation failed", error);
    createNotification(user.id, "error", "Surat tugas WFH gagal dibuat", "Dokumen gagal diproses.");
    return Response.json({ message: "Surat tugas WFH gagal dibuat. Silakan coba kembali." }, { status: 500 });
  }
}
