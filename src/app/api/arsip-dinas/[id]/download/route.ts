import { checkApiAccess } from "@/lib/authorization";
import { createStorageDownloadUrl, downloadStorageObject, isStorageConfigured } from "@/lib/storage";
import { getArchiveDownload } from "@/lib/arsip-dinas";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const accessDenied = await checkApiAccess(["arsip-dinas"]);
  if (accessDenied) return accessDenied;
  if (!await getCurrentUser()) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Arsip tidak ditemukan." }, { status: 404 });
  const item = await getArchiveDownload(id);
  if (!item) return Response.json({ message: "Arsip tidak ditemukan." }, { status: 404 });
  try {
    if (isStorageConfigured()) return new Response(null, { status: 302, headers: { Location: await createStorageDownloadUrl(item.storageName, item.fileName), "Cache-Control": "private, no-store" } });
    const bytes = await downloadStorageObject(item.storageName, item.filePath);
    const fileName = item.fileName.replace(/[\r\n"\\]/g, "_");
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Length": String(bytes.length), "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(item.fileName)}`, "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ message: "Berkas arsip tidak dapat diunduh." }, { status: 404 });
  }
}
