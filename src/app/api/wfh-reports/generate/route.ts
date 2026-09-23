import { getCurrentUser } from "@/lib/session";
import { getReportEmployee, saveReport } from "@/lib/wfh-report-store";
import { wfhReportSchema } from "@/lib/wfh-report-validation";
import { generateWfhReport } from "@/lib/wfh-report-document";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  const parsed = wfhReportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: parsed.error.issues[0]?.message ?? "Periksa isian laporan." }, { status: 422 });
  const employee = await getReportEmployee(parsed.data.nip);
  if (!employee) return Response.json({ message: "Pegawai aktif tidak ditemukan." }, { status: 422 });
  try {
    const document = await generateWfhReport(employee, parsed.data);
    const saved = await saveReport(user.id, employee, parsed.data, document);
    return Response.json({ id: saved.id, fileName: saved.fileName, downloadUrl: `/api/wfh-reports/${saved.id}/download` }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ message: "Laporan gagal dibuat. Periksa template dan coba kembali." }, { status: 500 }); }
}
