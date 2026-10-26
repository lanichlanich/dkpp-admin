import { checkApiAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";
import { getEmployeeForSuratPerbantuan, saveSuratPerbantuanDocument } from "@/lib/surat-perbantuan";
import { suratPerbantuanSchema } from "@/lib/surat-perbantuan-validation";
import { generateSuratPerbantuanDocument } from "@/lib/surat-perbantuan-document";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const accessDenied = await checkApiAccess(["surat-perbantuan"]);
  if (accessDenied) return accessDenied;
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ message: "Data permintaan tidak valid." }, { status: 400 }); }
  const result = suratPerbantuanSchema.safeParse(body);
  if (!result.success) return Response.json({
    message: "Periksa kembali isian surat.", errors: result.error.flatten().fieldErrors,
  }, { status: 422 });

  try {
    // Resolve identity on the server so edited requests cannot override employee records.
    const employee = await getEmployeeForSuratPerbantuan(result.data.employeeNip);
    if (!employee) return Response.json({
      message: "Pegawai tidak aktif atau tidak ditemukan. Muat ulang halaman.",
      errors: { employeeNip: ["Pilih pegawai aktif dari daftar."] },
    }, { status: 422 });
    const document = await generateSuratPerbantuanDocument({ employee, values: result.data });
    const saved = await saveSuratPerbantuanDocument({ userId: user.id, employee, values: result.data, document });
    return new Response(new Uint8Array(document), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${saved.fileName}"`,
      "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    console.error("Surat perbantuan generation failed", error);
    return Response.json({ message: "Surat perbantuan gagal dibuat. Silakan coba kembali." }, { status: 500 });
  }
}
