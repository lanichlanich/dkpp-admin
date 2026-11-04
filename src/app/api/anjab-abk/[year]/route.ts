import { revalidatePath } from "next/cache";
import { checkApiAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";
import { AnjabError, getAnjabPlan, saveAnjabPlan } from "@/lib/anjab-abk";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  if (error instanceof AnjabError) return Response.json({ message: error.message }, { status: error.status, headers });
  if (error instanceof SyntaxError) return Response.json({ message: "Data JSON tidak valid." }, { status: 400, headers });
  console.error("Operasi Anjab-ABK gagal.", error);
  return Response.json({ message: "Data Anjab-ABK belum dapat diproses. Silakan coba lagi." }, { status: 500, headers });
}
export async function GET(_request: Request, { params }: { params: Promise<{ year: string }> }) {
  const denied = await checkApiAccess(["anjab-abk"]); if (denied) return denied;
  try { return Response.json(await getAnjabPlan(Number((await params).year)), { headers }); }
  catch (error) { return failure(error); }
}
export async function PUT(request: Request, { params }: { params: Promise<{ year: string }> }) {
  const denied = await checkApiAccess(["anjab-abk"]); if (denied) return denied;
  const user = await getCurrentUser(); if (!user) return Response.json({ message: "Silakan masuk kembali." }, { status: 401, headers });
  try {
    if (Number(request.headers.get("content-length")) > 512 * 1024) throw new AnjabError("Data perhitungan terlalu besar.", 413);
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 512 * 1024) throw new AnjabError("Data perhitungan terlalu besar.", 413);
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || !Object.hasOwn(body, "plan")) throw new AnjabError("Data perhitungan tidak valid.", 400);
    const record = await saveAnjabPlan(Number((await params).year), body.plan, body.revision, user.id);
    revalidatePath("/dashboard/anjab-abk");
    return Response.json({ ...record, message: "Perhitungan Anjab-ABK berhasil disimpan." }, { headers });
  } catch (error) { return failure(error); }
}
