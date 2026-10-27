import { z } from "zod";
import { checkApiAccess } from "@/lib/authorization";
import { closePltAssignment, deletePltAssignment, PltError, savePltAssignment } from "@/lib/plt-assignments";
import { readPltRequest } from "@/lib/plt-request";
import { PltFileError } from "@/lib/plt-files";

type Context = { params: Promise<{ id: string }> };
async function mutate(request: Request, context: Context, remove: boolean) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ message: "ID penugasan tidak valid." }, { status: 400 });
  try {
    if (remove) await deletePltAssignment(id);
    else {
      const { values, file } = await readPltRequest(request);
      if (values && typeof values === "object" && "action" in values && values.action === "close") await closePltAssignment(id);
      else await savePltAssignment(values, id, file);
    }
    return Response.json({ message: remove ? "Penugasan dihapus." : "Penugasan diperbarui." });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ message: "Data tidak valid." }, { status: 400 });
    if (error instanceof z.ZodError) return Response.json({ message: "Periksa isian penugasan.", errors: error.flatten().fieldErrors }, { status: 400 });
    if (error instanceof PltError || error instanceof PltFileError) return Response.json({ message: error.message }, { status: error.status });
    console.error("Gagal memperbarui penugasan Plt.", error);
    return Response.json({ message: "Perubahan gagal disimpan. Silakan coba lagi." }, { status: 500 });
  }
}
export async function PATCH(request: Request, context: Context) {
  const accessDenied = await checkApiAccess(["daftar-plt"]);
  if (accessDenied) return accessDenied;
  return mutate(request, context, false);
}
export async function DELETE(request: Request, context: Context) {
  const accessDenied = await checkApiAccess(["daftar-plt"]);
  if (accessDenied) return accessDenied;
  return mutate(request, context, true);
}
