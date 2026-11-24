import { checkApiAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";
import { OpenAiApiError, type OpenAiPart } from "@/lib/openai-client";
import { suggestSuratTugas } from "@/lib/surat-tugas-ai";
import { readSuratTugasRequest } from "@/lib/surat-tugas-request";
import { readSuratTugasSource } from "@/lib/surat-tugas-source";
import { suratTugasAiInput } from "@/lib/surat-tugas-validation";

export const runtime = "nodejs";
const active = new Set<string>();
const last = new Map<string, number>();
const result = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const denied = await checkApiAccess(["surat-tugas"]);
  if (denied) return denied;
  const user = await getCurrentUser();
  if (!user) return result({ message: "Silakan masuk kembali." }, 401);
  const multipart = request.headers.get("content-type")?.startsWith("multipart/form-data");
  const input: Response | { payload: unknown; source?: OpenAiPart } = await (multipart ? readSuratTugasSource(request) : readSuratTugasRequest(request, 20 * 1024));
  if (input instanceof Response) return input;
  const { source } = input;
  const parsed = suratTugasAiInput(!!source).safeParse(input.payload);
  if (!parsed.success) return result({ message: parsed.error.issues[0].code === "unrecognized_keys" ? "Kirim hanya catatan Dasar dan Penugasan." : parsed.error.issues[0].message }, 422);
  const now = Date.now();
  for (const [id, at] of last) if (now - at >= 15_000) last.delete(id);
  if (active.has(user.id) || active.size >= 4 || last.has(user.id)) return result({ message: "Tunggu sebentar sebelum meminta saran lagi." }, 429);
  active.add(user.id);
  last.set(user.id, now);
  try { return result(await suggestSuratTugas(parsed.data, source)); }
  catch (error) { return result({ message: error instanceof OpenAiApiError ? error.message : "Saran AI gagal dibuat. Anda tetap bisa mengisi manual." }, error instanceof OpenAiApiError ? error.status : 500); }
  finally { active.delete(user.id); }
}
