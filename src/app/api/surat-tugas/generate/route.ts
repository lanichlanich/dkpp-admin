import { readSuratTugasRequest } from "@/lib/surat-tugas-request";
import { checkApiAccess } from "@/lib/authorization";
import { renderSuratTugas, tugasPeople } from "@/lib/surat-tugas";
import { suratTugasSchema } from "@/lib/surat-tugas-validation";

export const runtime = "nodejs";
const failure = (message: string, status: number) => Response.json({ message }, { status });
export async function POST(request: Request) {
  const denied = await checkApiAccess(["surat-tugas"]);
  if (denied) return denied;
  const input = await readSuratTugasRequest(request, 56 * 1024);
  if (input instanceof Response) return input;
  const result = suratTugasSchema.safeParse(input.payload);
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
