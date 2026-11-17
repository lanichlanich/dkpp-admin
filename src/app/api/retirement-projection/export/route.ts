import { z } from "zod";
import { checkApiAccess } from "@/lib/authorization";
import { getProjectionEmployees } from "@/lib/retirement-projection-data";
import { buildRetirementProjection, POSITION_KINDS } from "@/lib/retirement-projection";
import { createProjectionExcel, createProjectionPdf } from "@/lib/retirement-projection-export";
import { jakartaToday } from "@/lib/plt-dates";
import source from "@/data/retirement-position-map-2026.json";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const positionIds = new Set(source.positions.map(position => position.id));
const highlightSchema = z.string().max(3000).default("").transform(value => value ? value.split(",") : [])
  .pipe(z.array(z.string().refine(id => positionIds.has(id))).max(source.positions.length)
    .refine(ids => new Set(ids).size === ids.length));
const schema = z.object({ format: z.enum(["xlsx", "pdf"]), startYear: z.coerce.number().int().min(2000).max(2095),
  kind: z.enum(["all", ...POSITION_KINDS]).default("all"), unit: z.string().max(250).default(""),
  asn: z.enum(["all", "PNS", "PPPK", "PPPK PW"]).default("all"), search: z.string().max(150).default(""), highlight: highlightSchema });

export async function GET(request: Request) {
  const denied = await checkApiAccess(["proyeksi-pensiun"]);
  if (denied) { Object.entries(headers).forEach(([key, value]) => denied.headers.set(key, value)); return denied; }
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ message: "Format atau filter proyeksi tidak valid." }, { status: 422, headers });
  try {
    const { format, highlight, ...filters } = parsed.data;
    const p = buildRetirementProjection(source.positions, await getProjectionEmployees(), filters, jakartaToday());
    const bytes = format === "xlsx" ? await createProjectionExcel(p) : await createProjectionPdf(p, highlight);
    return new Response(new Uint8Array(bytes), { headers: { ...headers,
      "Content-Type": parsed.data.format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="Proyeksi-Pensiun-DKPP-${p.years[0]}-${p.years[4]}.${parsed.data.format}"` } });
  } catch (error) {
    console.error("Ekspor proyeksi pensiun gagal", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ message: "Dokumen proyeksi gagal dibuat. Silakan coba kembali." }, { status: 500, headers });
  }
}
