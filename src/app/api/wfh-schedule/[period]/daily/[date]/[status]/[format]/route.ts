import { getCurrentUser } from "@/lib/session";
import { fridayDates, getScheduleEntries, getScheduleMonths, validPeriod, type WorkLocation } from "@/lib/wfh-schedule";
import { createDailyScheduleExcel, createDailySchedulePdf } from "@/lib/wfh-schedule-export";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ period: string; date: string; status: string; format: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  const { period, date, status, format } = await params;
  if (!validPeriod(period) || !fridayDates(period).includes(date) || !["WFH", "WFO"].includes(status) || !["xlsx", "pdf"].includes(format)) {
    return Response.json({ message: "Tanggal, status, atau format tidak valid." }, { status: 400 });
  }
  const month = (await getScheduleMonths()).find((item) => item.period === period);
  if (!month) return Response.json({ message: "Jadwal bulan tidak ditemukan." }, { status: 404 });
  const entries = await getScheduleEntries(period);
  const location = status as WorkLocation;
  const file = format === "xlsx"
    ? await createDailyScheduleExcel(date, location, entries)
    : await createDailySchedulePdf(date, location, entries);
  return new Response(new Uint8Array(file), { headers: {
    "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
    "Content-Disposition": `attachment; filename="Daftar-${status}-${date}.${format}"`,
    "Cache-Control": "private, no-store",
  } });
}
