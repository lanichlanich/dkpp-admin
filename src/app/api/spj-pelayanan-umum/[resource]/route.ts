import { checkApiAccess } from "@/lib/authorization";
import { createSpjReport, saveSpjType, saveSpjWorker, SpjError } from "@/lib/spj-service";
import { spjJson, spjResponse } from "@/lib/spj-api";
export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  const denied = await checkApiAccess(["spj-pelayanan-umum"]); if (denied) return denied;
  return spjResponse(async () => {
    const { resource } = await context.params, input = await spjJson(request);
    if (resource === "types") return { id: await saveSpjType(input) };
    if (resource === "workers") return { id: await saveSpjWorker(input) };
    if (resource === "reports") return { id: await createSpjReport(input) };
    throw new SpjError("Menu tidak ditemukan.", 404);
  }, 201);
}
