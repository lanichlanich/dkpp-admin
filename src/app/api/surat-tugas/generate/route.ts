import { checkApiAccess } from "@/lib/authorization";
import { renderSuratTugas, tugasPeople } from "@/lib/surat-tugas";
import { suratTugasSchema } from "@/lib/surat-tugas-validation";

export const runtime = "nodejs";
const failure = (message: string, status: number) => Response.json({ message }, { status });
export async function POST(request: Request) {
  const denied = await checkApiAccess(["surat-tugas"]);
  if (denied) return denied;
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
      if (size > 56 * 1024) { await reader.cancel(); return failure("Data surat terlalu besar.", 413); }
      raw += decoder.decode(value, { stream: true });
    }
  } catch { return failure("Data surat tidak dapat dibaca.", 400); }
  finally { reader?.releaseLock(); }
  let payload: unknown;
  try { payload = JSON.parse(raw + decoder.decode()); } catch { return failure("Data surat tidak valid.", 400); }
  const result = suratTugasSchema.safeParse(payload);
  if (!result.success) return failure(result.error.issues[0].message, 422);
  try {
    const { employees, signer } = await tugasPeople(result.data.employeeNips);
    if (employees.length !== result.data.employeeNips.length) return failure("Pegawai tidak aktif atau tidak ditemukan. Muat ulang daftar pegawai.", 422);
    if (!signer) return failure("Data penandatangan belum dapat diverifikasi di Daftar Pegawai. Hubungi pengelola data.", 422);
    const file = await renderSuratTugas(result.data, employees, signer);
    return new Response(new Uint8Array(file), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Surat-Tugas-${result.data.tanggal}.docx"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { console.error("Gagal membuat Surat Tugas", error); return failure("Surat gagal dibuat. Coba lagi.", 500); }
}
