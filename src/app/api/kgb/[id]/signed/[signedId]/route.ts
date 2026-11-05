import { checkApiAccess } from "@/lib/authorization";
import { readSignedKgb } from "@/lib/kgb-documents";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; signedId: string }> }) {
  const denied = await checkApiAccess(["kgb"]); if (denied) return denied;
  try {
    const { id, signedId } = await params, file = await readSignedKgb(id, signedId);
    if (!file) return Response.json({ message: "SK bertanda tangan tidak ditemukan." }, { status: 404, headers });
    return new Response(new Uint8Array(file.bytes), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file.fileName}"`, "X-Content-Type-Options": "nosniff", "Content-Length": String(file.bytes.length) } });
  } catch {
    return Response.json({ message: "Berkas SK belum tersedia. Silakan coba lagi." }, { status: 404, headers });
  }
}
