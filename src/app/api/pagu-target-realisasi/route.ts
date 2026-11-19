import { z } from "zod";
import { canAccessMenu } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/session";
import { PLANNING_MENU } from "@/lib/planning/model";
import { loadPlanning, planningView, PlanningError } from "@/lib/planning/store";
import { actionSchema, saveAction } from "@/lib/planning/actions";
import { budgetTemplate, planningCsv, XLSX_MIME } from "@/lib/planning/files";
import { evidenceDownload, finishUpload, localUpload, prepareUpload, uploadSchema } from "@/lib/planning/uploads";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });

async function withPlanning(request: Request, handler: (ctx: Awaited<ReturnType<typeof loadPlanning>>, params: URLSearchParams) => Promise<Response>) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new PlanningError("Silakan masuk kembali.", 401);
    if (!canAccessMenu(user, PLANNING_MENU)) throw new PlanningError("Anda tidak memiliki akses ke menu ini.", 403);
    const url = new URL(request.url);
    if (request.method !== "GET") {
      const host = request.headers.get("host") ?? url.host;
      const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.slice(0, -1);
      const origin = request.headers.get("origin");
      if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== `${protocol}://${host}`))
        throw new PlanningError("Permintaan tidak diizinkan.", 403);
    }
    const params = url.searchParams;
    const ctx = await loadPlanning(user, Number(params.get("year")), Number(params.get("quarter")));
    return await handler(ctx, params);
  } catch (error) {
    if (error instanceof PlanningError) return json({ message: error.message }, error.status);
    if (error instanceof z.ZodError) return json({
      message: "Periksa isian yang ditandai.", fields: Object.fromEntries(error.issues.map(issue => [issue.path.join("."), issue.message])),
    }, 422);
    if (error instanceof SyntaxError) return json({ message: "Data permintaan tidak valid." }, 400);
    console.error("Pagu, Target & Realisasi", error);
    return json({ message: "Data perencanaan belum dapat diproses. Silakan coba lagi." }, 500);
  }
}

export function GET(request: Request) {
  return withPlanning(request, async (ctx, params) => {
    const evidenceId = params.get("evidence");
    if (evidenceId) return evidenceDownload(ctx, evidenceId);
    const file = params.get("file");
    if (file === "template") {
      const bytes = await budgetTemplate(ctx);
      return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="Template-Pagu-${ctx.year}.xlsx"` } });
    }
    if (file === "anggaran" || file === "capaian") {
      const department = params.get("department");
      if (department && !ctx.catalog.departments.some(dep => dep.id === department)) throw new PlanningError("Bidang tidak ditemukan.");
      return new Response(planningCsv(ctx, file, department), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file}-${ctx.year}-TW${ctx.quarter}.csv"` } });
    }
    return json(planningView(ctx));
  });
}

export function POST(request: Request) {
  return withPlanning(request, async (ctx, params) => {
    const text = await request.text();
    if (Buffer.byteLength(text) > 128 * 1024) throw new PlanningError("Data terlalu besar.", 413);
    const body: unknown = JSON.parse(text);
    if (params.get("upload") === "prepare") return json(await prepareUpload(ctx, uploadSchema.parse(body)));
    if (params.get("upload") === "finish") {
      const { id } = z.object({ id: z.uuid() }).parse(body);
      return json({ preview: await finishUpload(ctx, id), message: "Berkas berhasil diperiksa." });
    }
    await saveAction(ctx, actionSchema.parse(body));
    return json({ message: "Perubahan tersimpan." });
  });
}

export function PUT(request: Request) {
  return withPlanning(request, async (ctx, params) => {
    await localUpload(ctx, z.uuid().parse(params.get("upload")), request);
    return json({ message: "Unggahan diterima." });
  });
}
