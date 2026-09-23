import { createNotification } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";
import { deleteWfhDocument } from "@/lib/wfh-documents";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/wfh/[id]">,
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });

  const { id } = await context.params;
  try {
    const deleted = await deleteWfhDocument(id);
    if (!deleted) return Response.json({ message: "Surat tugas WFH tidak ditemukan." }, { status: 404 });

    await createNotification(
      user.id,
      "warning",
      "Surat tugas WFH dihapus",
      `Surat nomor ${deleted.nomorSurat} untuk bulan ${deleted.bulanWfh} telah dihapus.`,
    );
    return Response.json({ message: "Surat tugas WFH berhasil dihapus." });
  } catch (error) {
    console.error("WFH document deletion failed", error);
    return Response.json({ message: "Surat tugas WFH gagal dihapus. Silakan coba kembali." }, { status: 500 });
  }
}
