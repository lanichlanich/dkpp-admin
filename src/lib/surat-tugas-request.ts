import "server-only";

const failure = (message: string, status: number) => Response.json({ message }, { status });
export async function readSuratTugasRequest(request: Request, maxBytes: number): Promise<Response | { payload: unknown }> {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const protocol = request.headers.get("x-forwarded-proto") || url.protocol.slice(0, -1);
  if (request.headers.get("sec-fetch-site") === "cross-site" || request.headers.get("origin") !== `${protocol}://${host}`) return failure("Sumber permintaan tidak valid.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return failure("Gunakan format JSON.", 415);
  const reader = request.body?.getReader();
  let raw = "", size = 0;
  const decoder = new TextDecoder();
  try {
    while (reader) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return failure("Data surat terlalu besar.", 413); }
      raw += decoder.decode(value, { stream: true });
    }
  } catch { return failure("Data surat tidak dapat dibaca.", 400); }
  finally { reader?.releaseLock(); }
  let payload: unknown;
  try { payload = JSON.parse(raw + decoder.decode()); } catch { return failure("Data surat tidak valid.", 400); }
  return { payload };
}
