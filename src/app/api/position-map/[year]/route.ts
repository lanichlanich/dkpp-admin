import { revalidatePath } from "next/cache";
import { checkApiAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";
import { getPositionMapState, PositionMapError, savePositionMapPlan } from "@/lib/position-map";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function failure(error: unknown) {
  if (error instanceof PositionMapError) return Response.json({ message: error.message }, { status: error.status, headers });
  if (error instanceof SyntaxError) return Response.json({ message: "Data JSON tidak valid." }, { status: 400, headers });
  console.error("Peta jabatan gagal diproses", error instanceof Error ? error.name : "Unknown error");
  return Response.json({ message: "Peta jabatan gagal diproses. Silakan coba lagi." }, { status: 500, headers });
}
async function denied() {
  const response = await checkApiAccess(["peta-jabatan"]);
  if (response) Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}
export async function GET(_request: Request, { params }: { params: Promise<{ year: string }> }) {
  const response = await denied(); if (response) return response;
  try { return Response.json(await getPositionMapState(Number((await params).year)), { headers }); }
  catch (error) { return failure(error); }
}
export async function PUT(request: Request, { params }: { params: Promise<{ year: string }> }) {
  const response = await denied(); if (response) return response;
  // Next.js may construct request.url with its internal localhost origin.
  // Compare the browser origin with the actual incoming host and proxy scheme.
  const url = new URL(request.url), host = request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.replace(":", "");
  const expectedOrigin = `${protocol}://${host}`;
  if ((request.headers.get("origin") && request.headers.get("origin") !== expectedOrigin) || request.headers.get("sec-fetch-site") === "cross-site")
    return Response.json({ message: "Permintaan tidak diizinkan." }, { status: 403, headers });
  const user = await getCurrentUser(); if (!user) return Response.json({ message: "Silakan masuk kembali." }, { status: 401, headers });
  try {
    if (Number(request.headers.get("content-length")) > 128 * 1024) throw new PositionMapError("Data peta jabatan terlalu besar.", 413);
    const text = await request.text(); if (Buffer.byteLength(text) > 128 * 1024) throw new PositionMapError("Data peta jabatan terlalu besar.", 413);
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || !Object.hasOwn(body, "plan")) throw new PositionMapError("Data peta jabatan tidak valid.");
    const record = await savePositionMapPlan(Number((await params).year), body.plan, body.revision, user.id);
    revalidatePath("/dashboard/peta-jabatan");
    return Response.json({ record, message: "Peta jabatan berhasil disimpan." }, { headers });
  } catch (error) { return failure(error); }
}
