import { archiveMetadataSchema, updateArchiveDocument } from "@/lib/arsip-dinas";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getCurrentUser()) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Arsip tidak ditemukan." }, { status: 404 });
  const body = await request.json().catch(() => null);
  const parsed = archiveMetadataSchema.safeParse(body);
  if (!parsed.success) return Response.json({ message: parsed.error.issues[0]?.message ?? "Data arsip tidak valid." }, { status: 422 });
  const document = await updateArchiveDocument(id, parsed.data);
  return document ? Response.json({ document }) : Response.json({ message: "Arsip tidak ditemukan." }, { status: 404 });
}
