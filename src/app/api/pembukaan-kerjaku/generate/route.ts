import { getCurrentUser } from "@/lib/session";
import { generatePembukaanKerjakuDocument } from "@/lib/pembukaan-kerjaku-document";
import { getEmployeesForKerjaku, kerjakuRequestSchema, saveKerjakuRequest } from "@/lib/pembukaan-kerjaku";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ message: "Data permintaan tidak valid." }, { status: 400 }); }
  const result = kerjakuRequestSchema.safeParse(body);
  if (!result.success) return Response.json({ message: "Periksa kembali isian surat.", errors: result.error.flatten().fieldErrors }, { status: 422 });
  const input = result.data;
  const active = new Map((await getEmployeesForKerjaku()).map((employee) => [employee.nip, employee]));
  const employees = input.employeeNips.map((nip) => active.get(nip));
  if (employees.some((employee) => !employee))
    return Response.json({ message: "Pilihan pegawai tidak aktif atau tidak ditemukan. Muat ulang halaman." }, { status: 422 });
  try {
    const document = await generatePembukaanKerjakuDocument({
      tanggalSurat: input.tanggalSurat, nomorSurat: input.nomorSurat,
      bulanDibuka: input.bulanDibuka, employees: employees as NonNullable<typeof employees[number]>[],
    });
    const saved = await saveKerjakuRequest({
      userId: user.id, nomorSurat: input.nomorSurat, tanggalSurat: input.tanggalSurat,
      bulanDibuka: input.bulanDibuka, employees: employees as NonNullable<typeof employees[number]>[], document,
    });
    return new Response(new Uint8Array(document), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${saved.fileName}"`, "Cache-Control": "no-store",
    } });
  } catch (error) {
    console.error("Kerjaku request generation failed", error);
    return Response.json({ message: "Surat gagal dibuat. Silakan coba kembali." }, { status: 500 });
  }
}
