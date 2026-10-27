import "server-only";
import { PltError } from "@/lib/plt-assignments";
import { MAX_MULTIPART_REQUEST_SIZE_BYTES } from "@/lib/upload-limits";

export async function readPltRequest(request: Request): Promise<{ values: unknown; file?: File }> {
  const limit = MAX_MULTIPART_REQUEST_SIZE_BYTES;
  if (Number(request.headers.get("content-length")) > limit) throw new PltError("Ukuran unggahan melebihi batas 2 MB.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PltError("Data penugasan tidak tersedia.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > limit) { await reader.cancel(); throw new PltError("Ukuran unggahan melebihi batas 2 MB.", 413); }
      chunks.push(part.value);
    }
    const type = request.headers.get("content-type") ?? "";
    const bytes = Buffer.concat(chunks);
    if (type.startsWith("application/json")) return { values: JSON.parse(bytes.toString("utf8")) };
    if (!type.startsWith("multipart/form-data")) throw new PltError("Gunakan formulir unggahan yang valid.");
    const form = await new Response(new Uint8Array(bytes), { headers: { "content-type": type } }).formData();
    const upload = form.get("skFile");
    return { values: Object.fromEntries(form.entries()), file: upload instanceof File && upload.size ? upload : undefined };
  } catch (error) {
    if (error instanceof PltError) throw error;
    throw new PltError("Data formulir atau unggahan tidak valid.");
  } finally { reader.releaseLock(); }
}
