import { getCurrentUser } from "@/lib/session";
import { getReportEmployee } from "@/lib/wfh-report-store";
import { reportContextSchema } from "@/lib/wfh-report-validation";
import { generateWfhTasks, GeminiError } from "@/lib/gemini-wfh";

export const runtime = "nodejs";
const inFlight = new Set<string>();
const lastRequest = new Map<string, number>();
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  const input = reportContextSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ message: "Pilih pegawai dan tanggal yang valid." }, { status: 422 });
  const employee = await getReportEmployee(input.data.nip);
  if (!employee?.position || !employee.unit) return Response.json({ message: "Pegawai aktif dengan jabatan dan unit kerja lengkap diperlukan." }, { status: 422 });
  const now = Date.now();
  for (const [id, at] of lastRequest) if (now - at > 60000) lastRequest.delete(id);
  if (inFlight.has(user.id) || now - (lastRequest.get(user.id) ?? 0) < 10000) return Response.json({ message: "Tunggu sebentar sebelum meminta usulan lagi." }, { status: 429 });
  lastRequest.set(user.id, now); inFlight.add(user.id);
  try { return Response.json(await generateWfhTasks(employee), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ message: error instanceof GeminiError ? error.message : "Usulan tugas gagal dibuat." }, { status: error instanceof GeminiError ? error.status : 500 }); }
  finally { inFlight.delete(user.id); }
}
