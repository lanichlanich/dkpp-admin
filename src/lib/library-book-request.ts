import "server-only";
import { LibraryError } from "@/lib/library";
import { libraryJson } from "@/lib/library-api";
import { MAX_MULTIPART_REQUEST_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

export async function readLibraryBookRequest(request: Request): Promise<{ values: unknown; cover?: File | null }> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data")) return { values: await libraryJson(request) };

  const limit = MAX_MULTIPART_REQUEST_SIZE_BYTES;
  const tooLarge = () => new LibraryError(`Ukuran cover maksimal ${MAX_UPLOAD_SIZE_MB} MB.`, 413);
  if (Number(request.headers.get("content-length")) > limit) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new LibraryError("Data buku tidak tersedia.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > limit) {
        await reader.cancel().catch(() => {});
        throw tooLarge();
      }
      chunks.push(part.value);
    }
    const form = await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { "content-type": type } }).formData();
    const values = form.get("book");
    const covers = form.getAll("cover");
    const file = covers[0];
    const remove = form.get("removeCover") === "true";
    if (typeof values !== "string" || covers.length > 1 || (file !== undefined && (!(file instanceof File) || remove))) {
      throw new LibraryError("Data buku atau pilihan cover tidak valid.");
    }
    return { values: JSON.parse(values), cover: file instanceof File ? file : remove ? null : undefined };
  } catch (error) {
    if (error instanceof LibraryError) throw error;
    throw new LibraryError("Formulir buku atau cover tidak dapat dibaca.");
  } finally {
    reader.releaseLock();
  }
}
