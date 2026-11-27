import { canAccessMenu } from "@/lib/access-control";
import { deletePdfToolDocument, PdfToolsDocumentError, readPdfToolDocument, renamePdfToolDocument } from "@/lib/pdf-tools-documents";
import { getCurrentUser } from "@/lib/session";
import { isSuratTugasSameOrigin, readSuratTugasRequest } from "@/lib/surat-tugas-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MENU = "pdf-tools-documents";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const failure = (message: string, status: number) => Response.json({ message }, { status, headers });
const notFound = () => failure("Dokumen tidak ditemukan.", 404);

type Context = { params: Promise<{ id: string }> };

async function withAccess(request: Request, { params }: Context, handler: (ownerId: string, id: string) => Promise<Response>) {
  const user = await getCurrentUser();
  if (!user) return failure("Silakan masuk kembali.", 401);
  if (!canAccessMenu(user, MENU)) return failure("Anda tidak memiliki akses ke fitur ini.", 403);
  if (request.method !== "GET" && request.method !== "HEAD" && !isSuratTugasSameOrigin(request)) {
    return failure("Sumber permintaan tidak valid.", 403);
  }
  const { id } = await params;
  try {
    return await handler(user.id, id);
  } catch (error) {
    if (error instanceof PdfToolsDocumentError) return failure(error.message, error.status);
    return failure("Arsip PDF tidak tersedia. Coba lagi atau hubungi administrator.", 503);
  }
}

export function GET(request: Request, context: Context) {
  return withAccess(request, context, async (ownerId, id) => {
    const document = await readPdfToolDocument(ownerId, id);
    if (!document) return notFound();
    const encoded = encodeURIComponent(document.name).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(new Uint8Array(document.bytes), { headers: {
      ...headers,
      "Content-Type": "application/pdf",
      "Content-Length": String(document.bytes.length),
      "Content-Disposition": `attachment; filename="Dokumen.pdf"; filename*=UTF-8''${encoded}`,
    } });
  });
}

export function PATCH(request: Request, context: Context) {
  return withAccess(request, context, async (ownerId, id) => {
    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return failure("Gunakan format JSON.", 415);
    const result = await readSuratTugasRequest(request, 2048);
    if (result instanceof Response) return failure(result.status === 413 ? "Data nama dokumen terlalu besar." : "Data nama dokumen tidak valid.", result.status);
    const payload = result.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).length !== 1 || !("name" in payload) || typeof payload.name !== "string") {
      return failure("Kirim hanya nama dokumen yang baru.", 400);
    }
    const document = await renamePdfToolDocument(ownerId, id, payload.name);
    return document ? Response.json({ document }, { headers }) : notFound();
  });
}

export function DELETE(request: Request, context: Context) {
  return withAccess(request, context, async (ownerId, id) =>
    await deletePdfToolDocument(ownerId, id) ? new Response(null, { status: 204, headers }) : notFound());
}
