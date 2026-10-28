import { checkApiAccess } from "@/lib/authorization";
import { MAX_ARCHIVE_UPLOAD_SIZE_BYTES, MAX_ARCHIVE_UPLOAD_SIZE_MB, MAX_ARCHIVE_MULTIPART_REQUEST_SIZE_BYTES } from "@/lib/upload-limits";
import { getCurrentUser } from "@/lib/session";
import { archiveMetadataSchema, listArchiveDocuments, saveArchiveDocument, saveUploadedArchiveDocument } from "@/lib/arsip-dinas";
import { ArchiveUploadError } from "@/lib/archive-uploads";

export const runtime = "nodejs";

export async function GET() {
  const accessDenied = await checkApiAccess(["arsip-dinas"]);
  if (accessDenied) return accessDenied;
  if (!await getCurrentUser()) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  return Response.json({ documents: await listArchiveDocuments() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const accessDenied = await checkApiAccess(["arsip-dinas"]);
  if (accessDenied) return accessDenied;
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  const json = request.headers.get("content-type")?.includes("application/json");
  if (Number(request.headers.get("content-length") || 0) > (json ? 4096 : MAX_ARCHIVE_MULTIPART_REQUEST_SIZE_BYTES)) return Response.json({ message: `PDF maksimal ${MAX_ARCHIVE_UPLOAD_SIZE_MB} MB.` }, { status: 413 });
  try {
    if (json) {
      const input = await request.json();
      const parsed = archiveMetadataSchema.safeParse(input);
      if (!parsed.success || typeof input.uploadId !== "string") return Response.json({ message: "Data arsip tidak valid." }, { status: 422 });
      const document = await saveUploadedArchiveDocument({ userId: user.id, metadata: parsed.data, uploadId: input.uploadId });
      return Response.json({ document }, { status: 201 });
    }
    const form = await request.formData();
    const parsed = archiveMetadataSchema.safeParse({ namaDokumen: form.get("namaDokumen"), nomor: form.get("nomor") || "", jenisDokumen: form.get("jenisDokumen"), tglDokumen: form.get("tglDokumen") });
    if (!parsed.success) return Response.json({ message: parsed.error.issues[0]?.message ?? "Data arsip tidak valid." }, { status: 422 });
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return Response.json({ message: "Pilih berkas PDF." }, { status: 422 });
    if (file.size > MAX_ARCHIVE_UPLOAD_SIZE_BYTES) return Response.json({ message: `Ukuran PDF maksimal ${MAX_ARCHIVE_UPLOAD_SIZE_MB} MB.` }, { status: 413 });
    const bytes = Buffer.from(await file.arrayBuffer());
    if (file.type !== "application/pdf" || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return Response.json({ message: "Berkas yang diunggah harus PDF yang valid." }, { status: 422 });
    const document = await saveArchiveDocument({ userId: user.id, metadata: parsed.data, file: bytes });
    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return Response.json({ message: error instanceof ArchiveUploadError ? error.message : "Arsip gagal disimpan. Periksa koneksi penyimpanan lalu coba kembali." }, { status: error instanceof ArchiveUploadError ? error.status : 500 });
  }
}
