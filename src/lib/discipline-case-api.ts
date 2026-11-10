import "server-only";
import { z } from "zod";
import { checkApiAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";
import { DISCIPLINE_MENU } from "@/lib/discipline-case";
import { DisciplineCaseError, saveDisciplineCase } from "@/lib/discipline-cases";

export async function disciplineCaseResponse(operation: () => Promise<Response>) {
  try { return await operation(); }
  catch (error) {
    if (error instanceof DisciplineCaseError) return Response.json({ message: error.message }, { status: error.status });
    console.error("Administrasi disiplin gagal", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ message: "Perkara atau dokumen tidak dapat diproses." }, { status: 500 });
  }
}

const inputSchema = z.object({ values: z.unknown(), version: z.number().int().min(1).optional() });
export async function saveDisciplineCaseRequest(request: Request, id?: string) {
  const denied = await checkApiAccess([DISCIPLINE_MENU]);
  if (denied) return denied;
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  return disciplineCaseResponse(async () => {
    if (Number(request.headers.get("content-length")) > 65_536) throw new DisciplineCaseError("Ukuran isian terlalu besar.", 413);
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || (id && (!z.uuid().safeParse(id).success || !parsed.data.version)))
      throw new DisciplineCaseError("Data perkara atau versi tidak valid.", 422);
    const record = await saveDisciplineCase(user.id, parsed.data.values, id ? { id, version: parsed.data.version! } : undefined);
    return Response.json({ record }, { status: id ? 200 : 201, headers: { "Cache-Control": "private, no-store" } });
  });
}
