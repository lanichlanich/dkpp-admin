import { z } from "zod";
import { getHukdisEmployees } from "@/lib/employees";
import { getHukdisRecords } from "@/lib/hukdis";
import { generateHukdisReportDocument } from "@/lib/hukdis-report-document";
import { getCurrentUser } from "@/lib/session";
import { DEFAULT_SIGNATORY } from "@/lib/signatory";

export const runtime = "nodejs";

const exportSchema = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Data permintaan tidak valid." }, { status: 400 });
  }

  const result = exportSchema.safeParse(body);
  if (!result.success) return Response.json({ message: "Periode laporan tidak valid." }, { status: 422 });

  try {
    const [employees, records] = await Promise.all([getHukdisEmployees(), getHukdisRecords(result.data.period)]);
    const head = employees.find((employee) => /RORY\s+FIRMANSYAH/i.test(employee.name));
    const document = generateHukdisReportDocument({ period: result.data.period, employees, records, signatory: { ...DEFAULT_SIGNATORY, nip: head?.nip ?? "" } });
    return new Response(new Uint8Array(document), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Daftar-Hukdis-${result.data.period}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Hukdis report DOCX generation failed", error);
    return Response.json({ message: "DOCX daftar Hukdis gagal dibuat. Silakan coba kembali." }, { status: 500 });
  }
}
