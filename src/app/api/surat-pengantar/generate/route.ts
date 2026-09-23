import { formatIndonesianDate } from "@/lib/kgb";
import { createNotification } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";
import { generateSuratPengantarDocument } from "@/lib/surat-pengantar-document";
import { saveSuratPengantarDocument } from "@/lib/surat-pengantar-documents";
import { suratPengantarSchema } from "@/lib/surat-pengantar-validation";

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

  const result = suratPengantarSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { message: "Periksa kembali isian yang ditandai.", errors: result.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const input = result.data;
  try {
    const document = await generateSuratPengantarDocument({
      tanggal: formatIndonesianDate(input.tanggalSurat),
      "no surat": input.nomorSurat,
      no: String(input.nomorUrut),
      "file yang dikirim": input.fileYangDikirim,
      jumlah: String(input.jumlah),
    });
    const savedDocument = await saveSuratPengantarDocument({
      userId: user.id,
      nomorSurat: input.nomorSurat,
      tanggalSurat: input.tanggalSurat,
      nomorUrut: input.nomorUrut,
      fileYangDikirim: input.fileYangDikirim,
      jumlah: input.jumlah,
      document,
    });
    createNotification(
      user.id,
      "success",
      "Surat pengantar dibuat",
      `Surat pengantar nomor ${input.nomorSurat} berhasil dibuat dan disimpan ke daftar dokumen.`,
    );
    return new Response(new Uint8Array(document), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${savedDocument.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Surat pengantar generation failed", error);
    createNotification(user.id, "error", "Surat pengantar gagal dibuat", "Dokumen gagal diproses.");
    return Response.json({ message: "Surat pengantar gagal dibuat. Silakan coba kembali." }, { status: 500 });
  }
}
