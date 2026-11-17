import { z } from "zod";
import { checkApiAccess } from "@/lib/authorization";
import { getStaffProfileData } from "@/lib/staff-profile-data";
import { buildStaffProfile } from "@/lib/staff-profile";
import { createStaffProfileDocx, createStaffProfilePdf } from "@/lib/staff-profile-export";
import { jakartaToday } from "@/lib/plt-dates";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const schema = z.object({ format: z.enum(["pdf", "docx"]), startYear: z.coerce.number().int().min(2000).max(2095) });
export async function GET(request: Request) {
  const denied = await checkApiAccess(["profil-kepegawaian"]);
  if (denied) { Object.entries(headers).forEach(([key, value]) => denied.headers.set(key, value)); return denied; }
  const today = jakartaToday();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse({ startYear: Number(today.slice(0, 4)) + 1, ...params });
  if (!parsed.success) return Response.json({ message: "Format dokumen atau tahun awal proyeksi tidak valid." }, { status: 422, headers });
  try {
    const report = buildStaffProfile(await getStaffProfileData(), today, parsed.data.startYear);
    const format = parsed.data.format;
    const bytes = format === "pdf" ? await createStaffProfilePdf(report) : createStaffProfileDocx(report);
    return new Response(new Uint8Array(bytes), { headers: { ...headers,
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Profil-Kepegawaian-DKPP-${today}.${format}"`,
    } });
  } catch (error) {
    console.error("Ekspor profil kepegawaian gagal", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ message: "Profil kepegawaian gagal dibuat. Silakan coba kembali." }, { status: 500, headers });
  }
}
