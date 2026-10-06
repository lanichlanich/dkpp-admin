import { getCurrentUser } from "@/lib/session";
import {
  getEmployeesForSuratLupaAbsen,
  saveSuratLupaAbsenDocument,
  suratLupaAbsenSchema,
} from "@/lib/surat-lupa-absen-pulang";
import { generateSuratLupaAbsenPulangDocument } from "@/lib/surat-lupa-absen-pulang-document";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ message: "Data permintaan tidak valid." }, { status: 400 }); }
  const result = suratLupaAbsenSchema.safeParse(body);
  if (!result.success) return Response.json({
    message: "Periksa kembali isian surat.", errors: result.error.flatten().fieldErrors,
  }, { status: 422 });

  const input = result.data;
  const employees = new Map((await getEmployeesForSuratLupaAbsen()).map((employee) => [employee.nip, employee]));
  const employee = employees.get(input.employeeNip);
  const supervisor = employees.get(input.supervisorNip);
  if (!employee || !supervisor) return Response.json({
    message: "Pegawai atau atasan tidak aktif atau tidak ditemukan. Muat ulang halaman.",
  }, { status: 422 });

  try {
    const document = await generateSuratLupaAbsenPulangDocument({
      employee, absenceDate: input.absenceDate, letterDate: input.letterDate,
      reason: input.reason, supervisor,
    });
    const saved = await saveSuratLupaAbsenDocument({
      userId: user.id, employee, absenceDate: input.absenceDate, letterDate: input.letterDate,
      reason: input.reason, supervisor, document,
    });
    await createNotification(user.id, "success", "Surat lupa absen pulang dibuat", `${employee.name}: surat berhasil dibuat dan disimpan ke arsip.`);
    return new Response(new Uint8Array(document), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${saved.fileName}"`,
      "Cache-Control": "no-store",
    } });
  } catch (error) {
    console.error("Surat lupa absen pulang generation failed", error);
    await createNotification(user.id, "error", "Surat lupa absen pulang gagal dibuat", "Dokumen gagal diproses.");
    return Response.json({ message: "Surat gagal dibuat. Silakan coba kembali." }, { status: 500 });
  }
}
