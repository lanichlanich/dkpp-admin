import { z } from "zod";
import { checkApiAccess } from "@/lib/authorization";
import { getLibraryStatistics } from "@/lib/library-statistics";
import { jakartaToday } from "@/lib/plt-dates";

export async function GET(request: Request) {
  const denied = await checkApiAccess(["perpustakaan-statistik"]);
  if (denied) return denied;
  try {
    const data = await getLibraryStatistics(new URL(request.url).searchParams.get("period") ?? jakartaToday().slice(0,7));
    return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ message: "Pilih periode bulan yang valid." }, { status: 400 });
    console.error("Statistik perpustakaan gagal dimuat", error);
    return Response.json({ message: "Statistik gagal dimuat. Silakan coba lagi." }, { status: 500 });
  }
}
