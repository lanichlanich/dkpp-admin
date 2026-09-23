import { createNotification } from "@/lib/notifications";
import { deleteOfficialStatementDocument } from "@/lib/official-statement-documents";
import { officialStatementTypeLabels } from "@/lib/official-statement-validation";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/surat-hukdis-hukda/[id]">,
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  const { id } = await context.params;
  try {
    const deleted = await deleteOfficialStatementDocument(id);
    if (!deleted) return Response.json({ message: "Dokumen tidak ditemukan." }, { status: 404 });
    await createNotification(
      user.id,
      "warning",
      `${officialStatementTypeLabels[deleted.documentType]} dihapus`,
      `Surat nomor ${deleted.nomorSurat} telah dihapus.`,
    );
    return Response.json({ message: "Dokumen berhasil dihapus." });
  } catch (error) {
    console.error("Official statement deletion failed", error);
    return Response.json({ message: "Dokumen gagal dihapus. Silakan coba kembali." }, { status: 500 });
  }
}
