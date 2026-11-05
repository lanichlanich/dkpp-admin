import { revalidatePath } from "next/cache";
import { checkApiAccess } from "@/lib/authorization";
import { saveKgbDocument } from "@/lib/kgb-documents";
import { buildKgbDocument, KgbArchiveError } from "@/lib/kgb-service";
import { kgbSchema } from "@/lib/kgb-validation";
import { createNotification } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const denied = await checkApiAccess(["kgb"]); if (denied) return denied;
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ message: "Data permintaan tidak valid." }, { status: 400 }); }
  const parsed = kgbSchema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Periksa kembali isian yang ditandai.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  try {
    const input = parsed.data, { employee, document } = await buildKgbDocument(input);
    const saved = await saveKgbDocument({ userId: user.id, employeeNip: employee.nip, employeeName: employee.name, nomorSurat: input.nomorSurat, tglSurat: input.tglSurat, document, input });
    await createNotification(user.id, "success", "SK KGB dibuat", `Dokumen SK KGB ${employee.name} berhasil dibuat dan disimpan ke histori.`).catch(() => console.error("Notifikasi KGB belum tersimpan."));
    revalidatePath("/dashboard/kgb");
    return new Response(new Uint8Array(document), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${saved.fileName}"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof KgbArchiveError) return Response.json({ message: error.message }, { status: error.status });
    console.error("KGB document generation failed", error);
    return Response.json({ message: "Dokumen gagal dibuat. Silakan coba kembali." }, { status: 500 });
  }
}
