import "server-only";
import { z } from "zod";
import { LibraryError } from "@/lib/library";
export async function libraryJson(request: Request) {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > 64 * 1024) throw new LibraryError("Data formulir terlalu besar.", 413);
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
export async function libraryResponse(action: () => Promise<unknown>, status = 200) {
  try { return Response.json({ result: await action(), message: "Data perpustakaan berhasil disimpan." }, { status, headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    if (error instanceof LibraryError) return Response.json({ message: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return Response.json({ message: error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(" ") }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ message: "Data tidak valid." }, { status: 400 });
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (/23505|SQLITE_CONSTRAINT/.test(code)) return Response.json({ message: "Kode inventaris atau pegawai sudah terdaftar, atau data masih digunakan. Muat ulang daftar." }, { status: 409 });
    console.error("Operasi perpustakaan gagal", error);
    return Response.json({ message: "Data gagal disimpan. Silakan coba lagi." }, { status: 500 });
  }
}
