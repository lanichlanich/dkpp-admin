import { createNotification } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";
import { deleteSuratPengantarDocument } from "@/lib/surat-pengantar-documents";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/surat-pengantar/[id]">,
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });

  const { id } = await context.params;
  try {
    const deleted = await deleteSuratPengantarDocument(id);
    if (!deleted) return Response.json({ message: "Surat pengantar tidak ditemukan." }, { status: 404 });
    createNotification(
      user.id,
      "warning",
      "Surat pengantar dihapus",
      `Surat pengantar nomor ${deleted.nomorSurat} telah dihapus.`,
    );
    return Response.json({ message: "Surat pengantar berhasil dihapus." });
  } catch (error) {
    console.error("Surat pengantar deletion failed", error);
    return Response.json({ message: "Surat pengantar gagal dihapus. Silakan coba kembali." }, { status: 500 });
  }
}
