import { z } from "zod";
import { extractGeminiDocumentData, DocumentAiError } from "@/lib/gemini-document-ai";
import { getCurrentUser } from "@/lib/session";
import { MAX_MULTIPART_REQUEST_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

export const runtime = "nodejs";
const inputSchema = z.object({ kind: z.enum(["employee-document", "dpcp"]), employeeName: z.string().max(160), employeeNip: z.string().max(30), documentType: z.string().max(80) });
const active = new Set<string>();
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > MAX_MULTIPART_REQUEST_SIZE_BYTES) return Response.json({ message: `Total dokumen maksimal ${MAX_UPLOAD_SIZE_MB} MB.` }, { status: 413 });
  if (active.has(user.id)) return Response.json({ message: "Pembacaan sebelumnya masih berjalan." }, { status: 429 });
  active.add(user.id);
  try {
    const form = await request.formData();
    const parsed = inputSchema.safeParse(Object.fromEntries(["kind", "employeeName", "employeeNip", "documentType"].map(k => [k, form.get(k) || ""])));
    if (!parsed.success) return Response.json({ message: "Permintaan tidak valid." }, { status: 422 });
    const files = [...form.getAll("file"), ...form.getAll("files")].filter((v): v is File => v instanceof File && v.size > 0);
    return Response.json(await extractGeminiDocumentData({ kind: parsed.data.kind, files, context: { nama: parsed.data.employeeName, nip: parsed.data.employeeNip, jenisDokumen: parsed.data.documentType } }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ message: error instanceof DocumentAiError ? error.message : "Dokumen tidak dapat diproses. Periksa format berkas lalu coba kembali." }, { status: error instanceof DocumentAiError ? error.status : 400 });
  } finally { active.delete(user.id); }
}
