import { getCurrentUser } from "@/lib/session";
import { getScheduleEntries, getScheduleMonths, validPeriod } from "@/lib/wfh-schedule";
import { createScheduleExcel, createSchedulePdf } from "@/lib/wfh-schedule-export";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ period: string; format: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  const { period, format } = await params;
  if (!validPeriod(period) || !["xlsx", "pdf"].includes(format)) {
    return Response.json({ message: "Bulan atau format tidak valid." }, { status: 400 });
  }
  const month = (await getScheduleMonths()).find((item) => item.period === period);
  if (!month) return Response.json({ message: "Jadwal bulan tidak ditemukan." }, { status: 404 });
  const entries = await getScheduleEntries(period);
  const file = format === "xlsx" ? await createScheduleExcel(period, entries) : await createSchedulePdf(period, entries);
  return new Response(new Uint8Array(file), { headers: {
    "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
    "Content-Disposition": `attachment; filename="Daftar-WFH-WFO-${period}.${format}"`,
    "Cache-Control": "private, no-store",
  } });
}
