import { checkApiAccess } from "@/lib/authorization";
import { deleteSpjItem, saveSpjType, saveSpjWorker, SpjError } from "@/lib/spj-service";
import { spjJson, spjResponse } from "@/lib/spj-api";
type Context = { params: Promise<{ resource: string; id: string }> };
export async function PATCH(request: Request, context: Context) {
  const denied = await checkApiAccess(["spj-pelayanan-umum"]); if (denied) return denied;
  return spjResponse(async () => {
    const { resource, id } = await context.params, input = await spjJson(request);
    if (resource === "types") return { id: await saveSpjType(input, id) };
    if (resource === "workers") return { id: await saveSpjWorker(input, id) };
    throw new SpjError("Menu tidak ditemukan.", 404);
  });
}
export async function DELETE(request: Request, context: Context) {
  const denied = await checkApiAccess(["spj-pelayanan-umum"]); if (denied) return denied;
  return spjResponse(async () => { const { resource, id } = await context.params; await deleteSpjItem(resource, id, await spjJson(request)); return { deleted: true }; });
}
