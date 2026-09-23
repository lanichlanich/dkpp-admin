import { getEmployeeDocumentForDownload } from "@/lib/employee-documents";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

function contentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/employees/[nip]/documents/[id]/download">,
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });

  const { nip, id } = await context.params;
  try {
    const document = await getEmployeeDocumentForDownload(nip, id);
    if (!document) return Response.json({ message: "Dokumen tidak ditemukan." }, { status: 404 });
    return new Response(new Uint8Array(document.file), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": contentDisposition(document.fileName),
        "Content-Length": String(document.file.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Employee document download failed", error);
    return Response.json({ message: "File arsip tidak tersedia." }, { status: 404 });
  }
}
