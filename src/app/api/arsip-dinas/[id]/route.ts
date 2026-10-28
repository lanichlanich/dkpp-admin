import { checkApiAccess } from "@/lib/authorization";
import { z } from "zod";
import { archiveMetadataSchema, deleteArchiveDocument, updateArchiveDocument } from "@/lib/arsip-dinas";
import { ArchiveUploadError } from "@/lib/archive-uploads";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const accessDenied = await checkApiAccess(["arsip-dinas"]);
  if (accessDenied) return accessDenied;
  if (!await getCurrentUser()) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Arsip tidak ditemukan." }, { status: 404 });
  const body = await request.json().catch(() => null);
  const parsed = archiveMetadataSchema.safeParse(body);
  if (!parsed.success) return Response.json({ message: parsed.error.issues[0]?.message ?? "Data arsip tidak valid." }, { status: 422 });
  const document = await updateArchiveDocument(id, parsed.data);
  return document ? Response.json({ document }) : Response.json({ message: "Arsip tidak ditemukan." }, { status: 404 });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await checkApiAccess(["arsip-dinas"]);
  if (denied) return denied;
  if (!await getCurrentUser()) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Arsip tidak ditemukan." }, { status: 404 });
  if (Number(request.headers.get("content-length") || 0) > 1024) return Response.json({ message: "Permintaan tidak valid." }, { status: 413 });
  const version = z.string().max(80).regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/).refine(value => Number.isFinite(Date.parse(value)));
  const input = z.object({ confirmed: z.literal(true), updatedAt: version }).safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ message: "Konfirmasi penghapusan arsip diperlukan." }, { status: 422 });
  try {
    return Response.json({ message: "Arsip berhasil dihapus.", ...await deleteArchiveDocument(id, input.data.updatedAt) });
  } catch (error) {
    return Response.json({ message: error instanceof ArchiveUploadError ? error.message : "Arsip gagal dihapus. Coba kembali." }, { status: error instanceof ArchiveUploadError ? error.status : 500 });
  }
}
