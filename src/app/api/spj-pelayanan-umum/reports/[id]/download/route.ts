import { checkApiAccess } from "@/lib/authorization";
import { getSpjReport, SpjError } from "@/lib/spj-service";
import { spjResponse } from "@/lib/spj-api";
import { createSpjPdf, spjPdfFilename } from "@/lib/spj-pdf";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await checkApiAccess(["spj-pelayanan-umum"]); if (denied) return denied;
  try {
    const kind = new URL(request.url).searchParams.get("kind") ?? "attendance";
    if (kind !== "attendance" && kind !== "receipt") throw new SpjError("Jenis PDF tidak valid.");
    const snapshot = await getSpjReport((await context.params).id);
    const bytes = await createSpjPdf(snapshot, kind);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${spjPdfFilename(snapshot, kind)}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return spjResponse(async () => { throw error; }); }
}
