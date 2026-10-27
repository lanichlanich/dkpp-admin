import { checkApiAccess } from "@/lib/authorization";
import { z } from "zod";
import { extractGeminiDocumentData, DocumentAiError } from "@/lib/gemini-document-ai";
import { getCurrentUser } from "@/lib/session";
import { MAX_MULTIPART_REQUEST_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";
import { database as db } from "@/lib/database";
import { LOCAL_DOCUMENT_EXTRACTION_KINDS } from "@/lib/local-document-ai-types";

export const runtime = "nodejs";
const inputSchema = z.object({ kind: z.enum(LOCAL_DOCUMENT_EXTRACTION_KINDS), employeeName: z.string().max(160), employeeNip: z.string().max(30), documentType: z.string().max(80) });
const active = new Set<string>();
export async function POST(request: Request) {
  const accessDenied = await checkApiAccess(["pegawai","dpcp","arsip-dinas","daftar-plt"]);
  if (accessDenied) return accessDenied;
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > MAX_MULTIPART_REQUEST_SIZE_BYTES) return Response.json({ message: `Total dokumen maksimal ${MAX_UPLOAD_SIZE_MB} MB.` }, { status: 413 });
  if (active.has(user.id)) return Response.json({ message: "Pembacaan sebelumnya masih berjalan." }, { status: 429 });
  active.add(user.id);
  try {
    const form = await request.formData();
    const parsed = inputSchema.safeParse(Object.fromEntries(["kind", "employeeName", "employeeNip", "documentType"].map(k => [k, form.get(k) || ""])));
    if (!parsed.success) return Response.json({ message: "Permintaan tidak valid." }, { status: 422 });
    const kindAccess = await checkApiAccess([{ "employee-document": "pegawai", dpcp: "dpcp", "official-archive": "arsip-dinas", "plt-assignment": "daftar-plt" }[parsed.data.kind]]);
    if (kindAccess) return kindAccess;
    let employeeName = parsed.data.employeeName;
    if (parsed.data.kind === "plt-assignment") {
      if (!/^\d{18}$/.test(parsed.data.employeeNip)) return Response.json({ message: "Pilih pegawai sebelum membaca SK Plt." }, { status: 422 });
      const employee = await db.prepare("SELECT name FROM employees WHERE nip = ?").get<{ name: string }>(parsed.data.employeeNip);
      if (!employee) return Response.json({ message: "Pegawai tidak ditemukan." }, { status: 422 });
      employeeName = employee.name;
    }
    const files = [...form.getAll("file"), ...form.getAll("files")].filter((v): v is File => v instanceof File && v.size > 0);
    return Response.json(await extractGeminiDocumentData({ kind: parsed.data.kind, files, context: { nama: employeeName, nip: parsed.data.employeeNip, jenisDokumen: parsed.data.documentType } }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ message: error instanceof DocumentAiError ? error.message : "Dokumen tidak dapat diproses. Periksa format berkas lalu coba kembali." }, { status: error instanceof DocumentAiError ? error.status : 400 });
  } finally { active.delete(user.id); }
}
