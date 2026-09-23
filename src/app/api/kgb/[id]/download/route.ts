import { readFile } from "node:fs/promises";
import { getKgbDocumentForDownload } from "@/lib/kgb-documents";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/kgb/[id]/download">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });

  const { id } = await context.params;
  const document = getKgbDocumentForDownload(id);
  if (!document) return Response.json({ message: "Dokumen tidak ditemukan." }, { status: 404 });

  try {
    const file = await readFile(document.filePath);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${document.fileName}"`,
        "Content-Length": String(file.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("KGB history download failed", error);
    return Response.json({ message: "File arsip tidak tersedia." }, { status: 404 });
  }
}
