import { checkApiAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";
import { OpenAiApiError } from "@/lib/openai-client";
import { searchSuratTugasLegal } from "@/lib/surat-tugas-legal";
import { legalSearchInput } from "@/lib/surat-tugas-legal-validation";
import { readSuratTugasRequest } from "@/lib/surat-tugas-request";

export const runtime = "nodejs";
const active = new Set<string>();
const last = new Map<string, number>();
const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const denied = await checkApiAccess(["surat-tugas"]);
  if (denied) return denied;
  const user = await getCurrentUser();
  if (!user) return reply({ message: "Silakan masuk kembali." }, 401);
  const input = await readSuratTugasRequest(request, 2048);
  if (input instanceof Response) return input;
  const parsed = legalSearchInput.safeParse(input.payload);
  if (!parsed.success) return reply({ message: "Isi kata kunci peraturan (5–160 karakter), tanpa NIP, email, atau tautan." }, 422);
  const now = Date.now();
  for (const [id, at] of last) if (now - at >= 20_000) last.delete(id);
  if (active.has(user.id) || active.size >= 3 || last.has(user.id)) return reply({ message: "Tunggu sebentar sebelum mencari lagi." }, 429);
  last.set(user.id, now);
  active.add(user.id);
  try { return reply(await searchSuratTugasLegal(parsed.data.query)); }
  catch (error) { return reply({ message: error instanceof OpenAiApiError ? error.message : "Pencarian tidak tersedia. Anda tetap bisa mengisi Dasar secara manual." }, error instanceof OpenAiApiError ? error.status : 500); }
  finally { active.delete(user.id); }
}
