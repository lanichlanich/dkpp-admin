import { checkApiAccess } from "@/lib/authorization";
import { getSuratPerbantuanDownload } from "@/lib/surat-perbantuan";
import { downloadStorageObject } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/surat-perbantuan/[id]/download">) {
  const accessDenied = await checkApiAccess(["surat-perbantuan"]);
  if (accessDenied) return accessDenied;
  const { id } = await context.params;
  const document = await getSuratPerbantuanDownload(id);
  if (!document) return Response.json({ message: "Dokumen tidak ditemukan." }, { status: 404 });
  try {
    const file = await downloadStorageObject(document.storageName, document.filePath);
    return new Response(new Uint8Array(file), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${document.fileName}"`,
      "Content-Length": String(file.length),
      "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    console.error("Surat perbantuan download failed", error);
    return Response.json({ message: "File arsip tidak tersedia." }, { status: 404 });
  }
}
