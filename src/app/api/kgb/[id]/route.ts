import { revalidatePath } from "next/cache";
import { checkApiAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";
import { getKgbEditData, updateKgbDocument } from "@/lib/kgb-documents";
import { KgbArchiveError } from "@/lib/kgb-service";
import { kgbSchema } from "@/lib/kgb-validation";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  if (error instanceof KgbArchiveError) return Response.json({ message: error.message }, { status: error.status, headers });
  if (error instanceof SyntaxError) return Response.json({ message: "Data permintaan tidak valid." }, { status: 400, headers });
  console.error("Pengeditan arsip KGB gagal.", error);
  return Response.json({ message: "Dokumen KGB belum dapat diproses. Silakan coba lagi." }, { status: 500, headers });
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await checkApiAccess(["kgb"]); if (denied) return denied;
  try { const record = await getKgbEditData((await params).id); return record ? Response.json(record, { headers }) : Response.json({ message: "Dokumen tidak ditemukan." }, { status: 404, headers }); }
  catch (error) { return failure(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await checkApiAccess(["kgb"]); if (denied) return denied;
  const user = await getCurrentUser(); if (!user) return Response.json({ message: "Silakan masuk kembali." }, { status: 401, headers });
  try {
    if (Number(request.headers.get("content-length")) > 64 * 1024) return Response.json({ message: "Data form terlalu besar." }, { status: 413, headers });
    const text = await request.text(); if (Buffer.byteLength(text, "utf8") > 64 * 1024) return Response.json({ message: "Data form terlalu besar." }, { status: 413, headers });
    const body = JSON.parse(text), result = kgbSchema.safeParse(body);
    if (!result.success) return Response.json({ message: "Periksa kembali isian yang ditandai.", errors: result.error.flatten().fieldErrors }, { status: 422, headers });
    const saved = await updateKgbDocument((await params).id, result.data, body.revision, user.id);
    revalidatePath("/dashboard/kgb"); revalidatePath(`/dashboard/kgb/${(await params).id}/edit`);
    return new Response(new Uint8Array(saved.document), { headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${saved.fileName}"` } });
  } catch (error) { return failure(error); }
}
