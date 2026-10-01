import { deleteEmployeeDocument, updateEmployeeDocument } from "@/lib/employee-documents";
import { EMPLOYEE_DOCUMENT_TYPE_LABELS, getAllowedEmployeeDocumentTypes } from "@/lib/employee-document-types";
import { employeeDocumentEditSchema } from "@/lib/employee-document-validation";
import { database as db } from "@/lib/database";
import { createNotification } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteContext<"/api/employees/[nip]/documents/[id]">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  const { nip, id } = await context.params;
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ message: "Data dokumen tidak valid." }, { status: 400 }); }
  const result = employeeDocumentEditSchema.safeParse(body);
  if (!result.success) return Response.json({ message: "Periksa kembali isian dokumen.", errors: result.error.flatten().fieldErrors }, { status: 422 });
  const employee = await db.prepare("SELECT asn_type FROM employees WHERE nip = ?").get(nip) as { asn_type: string } | undefined;
  if (!employee) return Response.json({ message: "Pegawai tidak ditemukan." }, { status: 404 });
  if (!getAllowedEmployeeDocumentTypes(employee.asn_type).includes(result.data.documentType))
    return Response.json({ message: "Jenis dokumen tidak sesuai dengan jenis ASN pegawai." }, { status: 422 });
  try {
    const document = await updateEmployeeDocument(nip, id, result.data);
    if (!document) return Response.json({ message: "Dokumen tidak ditemukan." }, { status: 404 });
    return Response.json({ document, message: "Dokumen dan nama file berhasil diperbarui." });
  } catch (error) {
    console.error("Employee document update failed", error);
    return Response.json({ message: "Dokumen gagal diperbarui. Silakan coba kembali." }, { status: 500 });
  }
}

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

    await createNotification(
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
