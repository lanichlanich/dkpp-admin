import { checkApiAccess } from "@/lib/authorization";
import { isSuratTugasSameOrigin } from "@/lib/surat-tugas-request";
import { PdfToolError, processPdf } from "@/lib/pdf-tools";
import { PDF_TOOLS_MAX_BYTES, pdfTools } from "@/lib/pdf-tools-config";

export const runtime = "nodejs";
const MAX_REQUEST = PDF_TOOLS_MAX_BYTES + 64 * 1024;
let inUse = false;
const noCache = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const fail = (message: string, status: number) => Response.json({ message }, { status, headers: noCache });

async function readForm(request: Request, type: string) {
  const reader = request.body?.getReader();
  if (!reader) throw new PdfToolError("Unggahan kosong.");
  const chunks: Buffer[] = [];
  let bytes = 0;
  const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
  const abort = () => { void reader.cancel().catch(() => {}); };
  deadline.addEventListener("abort", abort, { once: true });
  try {
    for (;;) {
      deadline.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_REQUEST) { abort(); throw new PdfToolError("Total ukuran PDF maksimal 20 MB.", 413); }
      chunks.push(Buffer.from(value));
    }
    deadline.throwIfAborted();
    return await new Response(Buffer.concat(chunks), { headers: { "Content-Type": type } }).formData();
  } catch (error) {
    if (error instanceof PdfToolError) throw error;
    throw new PdfToolError("Unggahan tidak valid atau waktu unggah habis.");
  } finally {
    deadline.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ operation: string }> }) {
  const { operation } = await params;
  const tool = pdfTools.find(item => item.operation === operation);
  if (!tool) return fail("Alat PDF tidak ditemukan.", 404);
  const denied = await checkApiAccess([tool.slug]);
  if (denied) return denied;
  if (!isSuratTugasSameOrigin(request)) return fail("Sumber permintaan tidak valid.", 403);
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) return fail("Gunakan formulir unggahan PDF.", 415);
  if (Number(request.headers.get("content-length")) > MAX_REQUEST) return fail("Total ukuran PDF maksimal 20 MB.", 413);
  if (inUse) return fail("Tools PDF sedang memproses dokumen lain. Silakan coba lagi sebentar.", 429);
  inUse = true;
  try {
    const form = await readForm(request, contentType);
    const files = form.getAll("files");
    if (!files.every(value => value instanceof File)) return fail("Berkas unggahan tidak valid.", 400);
    const ranges = form.get("ranges");
    const profile = form.get("profile");
    if ((ranges !== null && typeof ranges !== "string") || (profile !== null && typeof profile !== "string")) return fail("Opsi PDF tidak valid.", 400);
    const results = await processPdf(tool.operation, files, { ranges: ranges ?? undefined, profile: profile ?? undefined, signal: request.signal });
    const body = new FormData();
    // Send titles separately from binary filenames to preserve Unicode consistently.
    body.set("metadata", JSON.stringify(results.map(({ name, pages, originalSize }) => ({ name, pages, originalSize }))));
    results.forEach(({ bytes }, i) => body.append("results", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), `${i + 1}.pdf`));
    return new Response(body, { headers: noCache });
  } catch (error) {
    if (error instanceof PdfToolError) return fail(error.message, error.status);
    return fail("Tools PDF tidak tersedia. Coba lagi atau hubungi administrator.", 503);
  } finally { inUse = false; }
}
