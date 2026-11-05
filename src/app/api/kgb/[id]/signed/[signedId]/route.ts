import { checkApiAccess } from "@/lib/authorization";
import { completeSignedKgbTmt, readSignedKgb } from "@/lib/kgb-documents";
import { KgbArchiveError } from "@/lib/kgb-service";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; signedId: string }> }) {
  const denied = await checkApiAccess(["kgb"]); if (denied) return denied;
  try {
    const { id, signedId } = await params, file = await readSignedKgb(id, signedId);
    if (!file) return Response.json({ message: "SK bertanda tangan tidak ditemukan." }, { status: 404, headers });
    return new Response(new Uint8Array(file.bytes), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file.fileName}"`, "X-Content-Type-Options": "nosniff", "Content-Length": String(file.bytes.length) } });
  } catch {
    return Response.json({ message: "Berkas SK belum tersedia. Silakan coba lagi." }, { status: 404, headers });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; signedId: string }> }) {
  const denied = await checkApiAccess(["kgb"]); if (denied) return denied;
  try {
    if (Number(request.headers.get("content-length")) > 4096) return Response.json({ message: "Data terlalu besar." }, { status: 413, headers });
    const text = await request.text(); if (Buffer.byteLength(text, "utf8") > 4096) return Response.json({ message: "Data terlalu besar." }, { status: 413, headers });
    const body = JSON.parse(text), { id, signedId } = await params;
    if (typeof body?.tmtKgb !== "string") throw new KgbArchiveError("Isi TMT KGB yang valid.");
    await completeSignedKgbTmt(id, signedId, body.tmtKgb);
    revalidatePath("/dashboard/kgb"); revalidatePath("/dashboard/pegawai"); revalidatePath("/dashboard", "layout");
    return Response.json({ message: "TMT SK tersimpan. Pengingat KGB berikutnya diperbarui." }, { headers });
  } catch (error) {
    if (error instanceof KgbArchiveError) return Response.json({ message: error.message }, { status: error.status, headers });
    if (error instanceof SyntaxError) return Response.json({ message: "Data tidak valid." }, { status: 400, headers });
    return Response.json({ message: "TMT belum berhasil disimpan." }, { status: 500, headers });
  }
}
