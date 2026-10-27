import { z } from "zod";
import { checkApiAccess } from "@/lib/authorization";
import { getPltAssignments, PltError, savePltAssignment } from "@/lib/plt-assignments";
import { readPltRequest } from "@/lib/plt-request";
import { PltFileError } from "@/lib/plt-files";

export async function GET() {
  const accessDenied = await checkApiAccess(["daftar-plt"]);
  if (accessDenied) return accessDenied;
  return Response.json(await getPltAssignments(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const accessDenied = await checkApiAccess(["daftar-plt"]);
  if (accessDenied) return accessDenied;
  try {
    const { values, file } = await readPltRequest(request);
    const id = await savePltAssignment(values, undefined, file);
    return Response.json({ id, message: "Penugasan Plt. berhasil disimpan." }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ message: "Data tidak valid." }, { status: 400 });
    if (error instanceof z.ZodError) return Response.json({ message: "Periksa isian penugasan.", errors: error.flatten().fieldErrors }, { status: 400 });
    if (error instanceof PltError || error instanceof PltFileError) return Response.json({ message: error.message }, { status: error.status });
    console.error("Gagal menyimpan penugasan Plt.", error);
    return Response.json({ message: "Penugasan gagal disimpan. Silakan coba lagi." }, { status: 500 });
  }
}
