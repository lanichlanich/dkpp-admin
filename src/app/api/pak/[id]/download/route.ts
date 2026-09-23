import { getPakDocumentForDownload } from "@/lib/pak-documents";
import { getCurrentUser } from "@/lib/session";
import { downloadStorageObject } from "@/lib/storage";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getCurrentUser()) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  const { id } = await context.params;
  const document = await getPakDocumentForDownload(id);
  if (!document) return Response.json({ message: "Dokumen tidak ditemukan." }, { status: 404 });
  try {
    const file = await downloadStorageObject(document.storageName, document.filePath);
    return new Response(new Uint8Array(file), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${document.fileName}"`, "Content-Length": String(file.length), "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ message: "File arsip tidak tersedia." }, { status: 404 }); }
}
