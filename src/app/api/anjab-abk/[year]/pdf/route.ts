import { checkApiAccess } from "@/lib/authorization";
import { createAnjabPlanSchema, validAnjabYear } from "@/lib/anjab-abk-calculation";
import { anjabCatalog } from "@/lib/anjab-abk-source";
import { anjabPdfSelectionSchema } from "@/lib/anjab-abk-pdf-options";
import { anjabPdfFilename, createAnjabPdf } from "@/lib/anjab-abk-pdf";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const fail = (message: string, status: number) => Response.json({ message }, { status, headers });

export async function POST(request: Request, { params }: { params: Promise<{ year: string }> }) {
  const denied = await checkApiAccess(["anjab-abk"]);
  if (denied) { denied.headers.set("Cache-Control", headers["Cache-Control"]); return denied; }
  const year = Number((await params).year);
  if (!validAnjabYear(year)) return fail("Tahun tidak valid.", 400);
  try {
    if (Number(request.headers.get("content-length")) > 512 * 1024) return fail("Data perhitungan terlalu besar.", 413);
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 512 * 1024) return fail("Data perhitungan terlalu besar.", 413);
    const body = JSON.parse(text);
    const selection = anjabPdfSelectionSchema.safeParse(body?.selection);
    if (!selection.success) return fail("Pilih jenis dokumen PDF yang valid.", 400);
    if (selection.data.kind === "detail") {
      const choice = selection.data, family = anjabCatalog.families.find(f => f.id === choice.familyId);
      if (!family || (choice.levelId && !family.levels.some(l => l.id === choice.levelId))) return fail("Jabatan atau jenjang dokumen tidak valid.", 400);
    }
    const plan = createAnjabPlanSchema(anjabCatalog).safeParse(body?.plan);
    if (!plan.success) return fail("Lengkapi seluruh isian perhitungan yang valid sebelum mengunduh PDF.", 422);
    const bytes = await createAnjabPdf(year, plan.data, anjabCatalog, selection.data);
    const filename = anjabPdfFilename(year, selection.data);
    // Deliver fetch downloads as JSON so browser PDF viewers cannot consume the response first.
    if (request.headers.get("accept") === "application/json") return Response.json({ filename, data: bytes.toString("base64") }, { headers: { ...headers, Vary: "Accept" } });
    return new Response(new Uint8Array(bytes), { headers: { ...headers, Vary: "Accept", "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (error) {
    if (error instanceof SyntaxError) return fail("Data JSON tidak valid.", 400);
    console.error("Unduhan PDF Anjab-ABK gagal.", error);
    return fail("Dokumen PDF belum dapat dibuat. Silakan coba lagi.", 500);
  }
}
