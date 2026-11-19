import { checkApiAccess } from "@/lib/authorization";
import { getPositionMapHeadSignatory, getPositionMapState, PositionMapError } from "@/lib/position-map";
import { createPositionMapDocx } from "@/lib/position-map-docx";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request, { params }: { params: Promise<{ year: string }> }) {
  const denied = await checkApiAccess(["peta-jabatan"]);
  if (denied) { Object.entries(headers).forEach(([key, value]) => denied.headers.set(key, value)); return denied; }
  try {
    const preset = new URL(request.url).searchParams.get("preset") ?? "all";
    if (preset !== "all" && preset !== "dinas-a4") throw new PositionMapError("Pilihan unduhan peta jabatan tidak valid.");
    const { record } = await getPositionMapState(Number((await params).year));
    const bytes = createPositionMapDocx(record.plan, record.year, preset === "dinas-a4" ? { preset, signatory: await getPositionMapHeadSignatory() } : {});
    return new Response(new Uint8Array(bytes), { headers: { ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${preset === "dinas-a4" ? `Peta-Jabatan-Dinas-DKPP-${record.year}-A4` : `Peta-Jabatan-DKPP-${record.year}`}.docx"`,
    } });
  } catch (error) {
    if (error instanceof PositionMapError) return Response.json({ message: error.message }, { status: error.status, headers });
    console.error("Peta jabatan DOCX gagal dibuat", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ message: "Peta jabatan belum dapat diunduh. Silakan coba lagi." }, { status: 500, headers });
  }
}
