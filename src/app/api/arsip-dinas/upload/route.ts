import { z } from "zod";
import { checkApiAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";
import { isStorageConfigured } from "@/lib/storage";
import { ArchiveUploadError, prepareArchiveUpload } from "@/lib/archive-uploads";
import { MAX_ARCHIVE_UPLOAD_SIZE_BYTES, MAX_ARCHIVE_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

export const runtime = "nodejs";
const schema = z.object({ fileName: z.string().max(255).regex(/\.pdf$/i), fileSize: z.number().int().min(1), contentType: z.literal("application/pdf") });

export async function POST(request: Request) {
  const denied = await checkApiAccess(["arsip-dinas"]);
  if (denied) return denied;
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 4096) return Response.json({ message: "Permintaan tidak valid." }, { status: 413 });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Pilih berkas PDF yang valid." }, { status: 422 });
    if (parsed.data.fileSize > MAX_ARCHIVE_UPLOAD_SIZE_BYTES) return Response.json({ message: `Ukuran PDF maksimal ${MAX_ARCHIVE_UPLOAD_SIZE_MB} MB.` }, { status: 413 });
    if (!isStorageConfigured()) return Response.json({ local: true });
    return Response.json(await prepareArchiveUpload(user.id, parsed.data.fileSize), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ message: error instanceof ArchiveUploadError ? error.message : "Unggahan belum dapat disiapkan. Coba kembali." }, { status: error instanceof ArchiveUploadError ? error.status : 500 });
  }
}
