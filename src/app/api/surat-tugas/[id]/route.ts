import { checkApiAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";
import { deleteSuratTugasDocument } from "@/lib/surat-tugas-documents";
import { isSuratTugasSameOrigin } from "@/lib/surat-tugas-request";

export const runtime = "nodejs";
const reply = (message: string, status = 200) => Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
export async function DELETE(request: Request, context: RouteContext<"/api/surat-tugas/[id]">) {
  const denied = await checkApiAccess(["surat-tugas"]);
  if (denied) return denied;
  if (!isSuratTugasSameOrigin(request)) return reply("Sumber permintaan tidak valid.", 403);
  const user = await getCurrentUser();
  if (!user) return reply("Silakan masuk kembali.", 401);
  try {
    const { id } = await context.params;
    const result = await deleteSuratTugasDocument(id, user);
    if (result === "missing") return reply("Surat Tugas tidak ditemukan.", 404);
    if (result === "forbidden") return reply("Hanya pembuat atau administrator yang dapat menghapus surat ini.", 403);
    return reply("Surat Tugas dihapus dari daftar.");
  } catch (error) {
    console.error("Penghapusan Surat Tugas gagal", error);
    return reply("Surat Tugas gagal dihapus. Coba lagi.", 500);
  }
}
