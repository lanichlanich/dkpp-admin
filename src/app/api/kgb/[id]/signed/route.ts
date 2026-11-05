import { revalidatePath } from "next/cache";
import { checkApiAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";
import { saveSignedKgb } from "@/lib/kgb-documents";
import { KgbArchiveError } from "@/lib/kgb-service";
import { MAX_MULTIPART_REQUEST_SIZE_BYTES, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await checkApiAccess(["kgb"]); if (denied) return denied;
  const user = await getCurrentUser(); if (!user) return Response.json({ message: "Silakan masuk kembali." }, { status: 401, headers });
  try {
    if (Number(request.headers.get("content-length")) > MAX_MULTIPART_REQUEST_SIZE_BYTES) throw new KgbArchiveError(`Ukuran PDF maksimal ${MAX_UPLOAD_SIZE_MB} MB.`, 413);
    let form: FormData;
    try { form = await request.formData(); } catch { throw new KgbArchiveError("Form unggahan tidak valid.", 400); }
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new KgbArchiveError("Pilih PDF SK KGB yang sudah ditandatangani.", 400);
    if (file.size > MAX_UPLOAD_SIZE_BYTES) throw new KgbArchiveError(`Ukuran PDF maksimal ${MAX_UPLOAD_SIZE_MB} MB.`, 413);
    if (file.type && !["application/pdf", "application/octet-stream"].includes(file.type)) throw new KgbArchiveError("File SK harus berupa PDF.");
    const suppliedTmt = form.get("tmtKgb");
    if (suppliedTmt !== null && typeof suppliedTmt !== "string") throw new KgbArchiveError("TMT KGB tidak valid.");
    const signed = await saveSignedKgb((await params).id, Number(form.get("revision")), user.id, file.name, Buffer.from(await file.arrayBuffer()), suppliedTmt || undefined);
    revalidatePath("/dashboard/kgb");
    revalidatePath("/dashboard/pegawai"); revalidatePath("/dashboard", "layout");
    return Response.json({ signed, message: "SK KGB bertanda tangan tersimpan dan tersedia di dokumen pegawai. Pengingat KGB berikutnya diperbarui." }, { status: 201, headers });
  } catch (error) {
    if (error instanceof KgbArchiveError) return Response.json({ message: error.message }, { status: error.status, headers });
    console.error("Unggahan SK KGB gagal.", error);
    return Response.json({ message: "Unggahan SK belum berhasil. Silakan coba lagi." }, { status: 500, headers });
  }
}
