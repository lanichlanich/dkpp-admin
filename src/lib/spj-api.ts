import "server-only";
import { z } from "zod";
import { SpjError } from "@/lib/spj-service";
export async function spjJson(request: Request) {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > 256 * 1024) throw new SpjError("Data formulir terlalu besar.", 413);
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
export async function spjResponse(action: () => Promise<unknown>, status = 200) {
  try { return Response.json({ result: await action(), message: "Data SPJ berhasil disimpan." }, { status, headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) {
    let message = "Proses SPJ gagal. Silakan coba lagi.", code = 500;
    if (error instanceof SpjError) { message = error.message; code = error.status; }
    else if (error instanceof z.ZodError) { message = error.issues.map(i => i.message).join(" "); code = 400; }
    else if (error instanceof SyntaxError) { message = "Data tidak valid."; code = 400; }
    else if (/23505|SQLITE_CONSTRAINT/.test(String((error as { code?: string })?.code))) { message = "Nama jenis sudah terdaftar atau data masih digunakan. Muat ulang halaman."; code = 409; }
    else console.error("Operasi SPJ pelayanan umum gagal", error);
    return Response.json({ message }, { status: code, headers: { "Cache-Control": "private, no-store" } });
  }
}
