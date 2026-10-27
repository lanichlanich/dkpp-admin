import { z } from "zod";
import { checkApiAccess } from "@/lib/authorization";
import { getPltDocument } from "@/lib/plt-assignments";
import { readPltFile } from "@/lib/plt-files";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const accessDenied = await checkApiAccess(["daftar-plt"]);
  if (accessDenied) return accessDenied;
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ message: "ID penugasan tidak valid." }, { status: 400 });
  const document = await getPltDocument(id);
  if (!document) return Response.json({ message: "SK Plt. belum tersedia." }, { status: 404 });
  try {
    const bytes = await readPltFile(document);
    if (!bytes) throw new Error("Invalid document metadata");
    const fallback = document.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      "Content-Length": String(bytes.length), "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    console.error("Unduh SK Plt. gagal", error);
    return Response.json({ message: "Berkas SK Plt. tidak tersedia." }, { status: 404 });
  }
}
