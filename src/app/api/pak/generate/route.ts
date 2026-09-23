import { db } from "@/lib/db";
import { generatePakDocument } from "@/lib/pak-document";
import { savePakDocument } from "@/lib/pak-documents";
import { pakSchema } from "@/lib/pak-validation";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ message: "Data permintaan tidak valid." }, { status: 400 }); }
  const result = pakSchema.safeParse(body);
  if (!result.success) return Response.json({ message: "Periksa kembali isian PAK.", errors: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 422 });
  const employee = db.prepare("SELECT name, status FROM employees WHERE nip = ? AND asn_type = 'PNS' AND status IN ('Aktif', 'Mutasi', 'Pensiun')").get(result.data.nip) as { name: string; status: string } | undefined;
  if (!employee) return Response.json({ message: "Pegawai PNS aktif, mutasi, atau pensiun tidak ditemukan." }, { status: 422 });
  try {
    const document = await generatePakDocument(result.data, employee.name);
    const saved = await savePakDocument(user.id, employee, result.data, document);
    return new Response(new Uint8Array(document), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${saved.fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Document-Id": saved.id,
    } });
  } catch (error) {
    console.error("PAK generation failed", error);
    return Response.json({ message: "Dokumen PAK gagal dibuat. Silakan coba kembali." }, { status: 500 });
  }
}
