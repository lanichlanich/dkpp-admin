import { deleteEmployeeDocument } from "@/lib/employee-documents";
import { EMPLOYEE_DOCUMENT_TYPE_LABELS } from "@/lib/employee-document-types";
import { createNotification } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/employees/[nip]/documents/[id]">,
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });

  const { nip, id } = await context.params;
  try {
    const deleted = await deleteEmployeeDocument(nip, id);
    if (!deleted) return Response.json({ message: "Dokumen tidak ditemukan." }, { status: 404 });

    createNotification(
      user.id,
      "warning",
      "Dokumen pegawai dihapus",
      `${EMPLOYEE_DOCUMENT_TYPE_LABELS[deleted.documentType]} dengan nama ${deleted.fileName} telah dihapus.`,
    );
    return Response.json({ message: "Dokumen berhasil dihapus." });
  } catch (error) {
    console.error("Employee document deletion failed", error);
    return Response.json({ message: "Dokumen gagal dihapus. Silakan coba kembali." }, { status: 500 });
  }
}
