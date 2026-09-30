import { getCurrentUser } from "@/lib/session";
import { getKerjakuRequestDownload } from "@/lib/pembukaan-kerjaku";
import { downloadStorageObject } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/pembukaan-kerjaku/[id]/download">) {
  if (!await getCurrentUser()) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  const { id } = await context.params;
  const document = await getKerjakuRequestDownload(id);
  if (!document) return Response.json({ message: "Dokumen tidak ditemukan." }, { status: 404 });
  try {
    const file = await downloadStorageObject(document.storageName, document.filePath);
    return new Response(new Uint8Array(file), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${document.fileName}"`,
      "Content-Length": String(file.length), "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    console.error("Kerjaku request download failed", error);
    return Response.json({ message: "File arsip tidak tersedia." }, { status: 404 });
  }
}
