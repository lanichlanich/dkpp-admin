import { z } from "zod";
import { checkApiAccess } from "@/lib/authorization";
import { createEmployeeExcel } from "@/lib/employee-export";
import { getEmployees } from "@/lib/employees";
import { jakartaToday } from "@/lib/plt-dates";

export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const exportSchema = z.object({
  nips: z.array(z.string().min(1).max(40)).min(1).max(10_000)
    .refine(nips => new Set(nips).size === nips.length, "Pilihan pegawai tidak boleh berulang."),
});

export async function POST(request: Request) {
  const denied = await checkApiAccess(["pegawai"]);
  if (denied) {
    for (const [key, value] of Object.entries(privateHeaders)) denied.headers.set(key, value);
    return denied;
  }
  const parsed = exportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Pilih 1 sampai 10.000 pegawai yang valid untuk diekspor." }, { status: 422, headers: privateHeaders });

  try {
    const employees = new Map((await getEmployees()).map(employee => [employee.nip, employee]));
    const selected = parsed.data.nips.map(nip => employees.get(nip));
    if (selected.some(employee => !employee)) {
      return Response.json({ message: "Sebagian pegawai sudah berubah. Muat ulang daftar lalu ekspor kembali." }, { status: 409, headers: privateHeaders });
    }
    const today = jakartaToday();
    const bytes = await createEmployeeExcel(selected.filter(employee => employee !== undefined), today);
    return new Response(new Uint8Array(bytes), { headers: {
      ...privateHeaders,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Daftar-Pegawai-${today}.xlsx"`,
    } });
  } catch (error) {
    console.error("Ekspor Excel pegawai gagal", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ message: "Excel daftar pegawai gagal dibuat. Silakan coba kembali." }, { status: 500, headers: privateHeaders });
  }
}
