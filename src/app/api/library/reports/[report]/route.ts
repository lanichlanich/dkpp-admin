import { checkApiAccess } from "@/lib/authorization";
import { getLibraryBooks, getLibraryLoans, getLibraryVisitors } from "@/lib/library";
import { libraryReportMenus, type LibraryReportKind } from "@/lib/library-report-types";
import { createLibraryReportExcel, createLibraryReportPdf, libraryBooksReport, libraryLoansReport, libraryVisitorsReport } from "@/lib/library-reports";
import { libraryPeriodSchema, libraryPeriodWindow } from "@/lib/library-statistics-types";
import { jakartaToday } from "@/lib/plt-dates";

export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  if (!Object.hasOwn(libraryReportMenus, report)) {
    return Response.json({ message: "Jenis laporan tidak ditemukan." }, { status: 404, headers: privateHeaders });
  }
  const kind = report as LibraryReportKind;
  const denied = await checkApiAccess([libraryReportMenus[kind]]);
  if (denied) {
    for (const [key, value] of Object.entries(privateHeaders)) denied.headers.set(key, value);
    return denied;
  }

  const query = new URL(request.url).searchParams;
  const format = query.get("format");
  if (format !== "pdf" && format !== "xlsx") {
    return Response.json({ message: "Pilih format PDF atau Excel." }, { status: 400, headers: privateHeaders });
  }
  const month = libraryPeriodSchema.safeParse(query.get("month"));
  if (kind === "loans" && !month.success) {
    return Response.json({ message: "Pilih bulan laporan yang valid." }, { status: 400, headers: privateHeaders });
  }

  try {
    const today = jakartaToday();
    let data;
    if (kind === "books") data = libraryBooksReport(await getLibraryBooks(), today);
    else if (kind === "visitors") data = libraryVisitorsReport(await getLibraryVisitors(), today);
    else {
      const window = libraryPeriodWindow(month.data);
      data = libraryLoansReport(await getLibraryLoans(window), window.period, today);
    }
    const bytes = format === "pdf" ? await createLibraryReportPdf(data) : await createLibraryReportExcel(data);
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...privateHeaders,
        "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${data.filename}.${format}"`,
      },
    });
  } catch (error) {
    console.error("Gagal membuat laporan perpustakaan", error);
    return Response.json({ message: "Laporan belum bisa dibuat. Silakan coba lagi." }, { status: 500, headers: privateHeaders });
  }
}
