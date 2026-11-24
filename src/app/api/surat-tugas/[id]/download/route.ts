import { checkApiAccess } from "@/lib/authorization";
import { getSuratTugasDownload } from "@/lib/surat-tugas-documents";

export const runtime = "nodejs";
export async function GET(_request: Request, context: RouteContext<"/api/surat-tugas/[id]/download">) {
  const denied = await checkApiAccess(["surat-tugas"]);
  if (denied) return denied;
  const headers = { "Cache-Control": "no-store" };
  try {
    const { id } = await context.params;
    return await getSuratTugasDownload(id) ?? Response.json({ message: "File Surat Tugas tidak tersedia." }, { status: 404, headers });
  } catch (error) {
    console.error("Unduh arsip Surat Tugas gagal", error);
    return Response.json({ message: "File Surat Tugas gagal dibaca." }, { status: 500, headers });
  }
}
