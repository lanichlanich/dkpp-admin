import { checkApiAccess } from "@/lib/authorization";
import { getScheduleEntries, validPeriod } from "@/lib/wfh-schedule";
import { combineScheduleLetter, readScheduleLetter, ScheduleLetterError } from "@/lib/wfh-schedule-letters";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ period: string; id: string; kind: string }> }) {
  const denied = await checkApiAccess(["laporan-pegawai-wfh-wfo"]);
  if (denied) return denied;
  const { period, id, kind } = await params;
  if (!validPeriod(period) || !["original", "combined"].includes(kind))
    return Response.json({ message: "Bulan atau jenis unduhan tidak valid." }, { status: 400 });
  try {
    const original = await readScheduleLetter(period, id);
    if (!original) return Response.json({ message: "Surat tugas bulan ini tidak ditemukan." }, { status: 404 });
    const file = kind === "original" ? original : await combineScheduleLetter(period, original, await getScheduleEntries(period));
    const name = kind === "original" ? "Surat-Tugas" : "Surat-Tugas-dan-Daftar";
    return new Response(new Uint8Array(file), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}-WFH-WFO-${period}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if (error instanceof ScheduleLetterError) return Response.json({ message: error.message }, { status: error.status });
    console.error("Gagal mengunduh surat tugas WFH/WFO.", error);
    return Response.json({ message: "Surat tugas gagal diunduh. Silakan coba lagi." }, { status: 500 });
  }
}
