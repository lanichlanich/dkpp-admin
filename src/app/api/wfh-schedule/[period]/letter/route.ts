import { revalidatePath } from "next/cache";
import { checkApiAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";
import { saveScheduleLetter, ScheduleLetterError } from "@/lib/wfh-schedule-letters";
import { MAX_MULTIPART_REQUEST_SIZE_BYTES, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ period: string }> }) {
  const denied = await checkApiAccess(["laporan-pegawai-wfh-wfo"]);
  if (denied) return denied;
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  try {
    if (Number(request.headers.get("content-length")) > MAX_MULTIPART_REQUEST_SIZE_BYTES)
      throw new ScheduleLetterError(`Ukuran PDF maksimal ${MAX_UPLOAD_SIZE_MB} MB.`, 413);
    let form: FormData;
    try { form = await request.formData(); }
    catch { throw new ScheduleLetterError("Form unggahan tidak valid.", 400); }
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new ScheduleLetterError("Pilih PDF surat tugas yang sudah ditandatangani.", 400);
    if (file.size > MAX_UPLOAD_SIZE_BYTES) throw new ScheduleLetterError(`Ukuran PDF maksimal ${MAX_UPLOAD_SIZE_MB} MB.`, 413);
    const { period } = await params;
    const letter = await saveScheduleLetter(period, user.id, file.name, Buffer.from(await file.arrayBuffer()));
    revalidatePath("/dashboard/laporan-pegawai-wfh-wfo");
    return Response.json({ letter, message: "Surat tugas berhasil diunggah. PDF gabungan siap diunduh." }, { status: 201 });
  } catch (error) {
    if (error instanceof ScheduleLetterError) return Response.json({ message: error.message }, { status: error.status });
    console.error("Gagal menyimpan surat tugas WFH/WFO.", error);
    return Response.json({ message: "Surat tugas gagal disimpan. Silakan coba lagi." }, { status: 500 });
  }
}
