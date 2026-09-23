import { readFile } from "node:fs/promises";
import { getCurrentUser } from "@/lib/session";
import { findReport, reportFilePath } from "@/lib/wfh-report-store";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  const { id } = await params;
  const report = findReport(id, user.id);
  if (!report) return Response.json({ message: "Laporan tidak ditemukan." }, { status: 404 });
  try {
    return new Response(new Uint8Array(await readFile(reportFilePath(id))), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${report.file_name}"`, "Cache-Control": "private, no-store",
    } });
  } catch { return Response.json({ message: "Berkas laporan tidak tersedia." }, { status: 404 }); }
}
