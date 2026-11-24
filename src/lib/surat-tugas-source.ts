import "server-only";
import { openAiFile } from "@/lib/openai-client";
import { SURAT_TUGAS_SOURCE_MAX_BYTES } from "@/lib/surat-tugas-validation";
import { isSuratTugasSameOrigin } from "@/lib/surat-tugas-request";

const errorResponse = (message: string, status: number) => Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
export async function readSuratTugasSource(request: Request) {
  if (!isSuratTugasSameOrigin(request)) return errorResponse("Sumber permintaan tidak valid.", 403);
  const reader = request.body?.getReader();
  if (!reader) return errorResponse("Lampiran tidak ditemukan.", 422);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > SURAT_TUGAS_SOURCE_MAX_BYTES + 20 * 1024) {
        await reader.cancel();
        return errorResponse("Ukuran lampiran maksimal 4 MB.", 413);
      }
      chunks.push(value);
    }
  } catch { return errorResponse("Unggahan tidak dapat dibaca.", 400); }
  finally { reader.releaseLock(); }
  try {
    const form = await new Response(new Uint8Array(Buffer.concat(chunks, total)), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
    const source = form.get("source");
    if ([...form.keys()].some(key => !["source", "dasar", "tugas"].includes(key)) || ["source", "dasar", "tugas"].some(key => form.getAll(key).length > 1)) return errorResponse("Isian unggahan tidak valid.", 422);
    if (!(source instanceof File) || !source.size) return errorResponse("Pilih satu surat dasar.", 422);
    if (source.size > SURAT_TUGAS_SOURCE_MAX_BYTES) return errorResponse("Ukuran lampiran maksimal 4 MB.", 413);
    const bytes = Buffer.from(await source.arrayBuffer());
    const format = bytes.subarray(0, 5).toString("ascii") === "%PDF-" ? ["pdf", "application/pdf"]
      : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? ["png", "image/png"]
      : bytes.subarray(0, 3).equals(Buffer.from([255,216,255])) ? ["jpg", "image/jpeg"] : null;
    if (!format || (source.type && source.type !== "application/octet-stream" && source.type !== format[1])) return errorResponse("Gunakan PDF, JPG, atau PNG yang valid.", 422);
    return { payload: { dasar: form.get("dasar") ?? "", tugas: form.get("tugas") ?? "" }, source: openAiFile(`surat-dasar.${format[0]}`, format[1], bytes) };
  } catch { return errorResponse("Format unggahan tidak dapat dibaca.", 400); }
}
