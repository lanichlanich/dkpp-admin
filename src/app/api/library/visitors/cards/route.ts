import { z } from "zod";
import { checkApiAccess } from "@/lib/authorization";
import { LibraryError, getLibraryCardVisitors } from "@/lib/library";
import { libraryJson } from "@/lib/library-api";
import { createLibraryCards } from "@/lib/library-card";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const denied = await checkApiAccess(["perpustakaan-pengunjung"]);
  if (denied) return denied;
  try {
    const visitors = await getLibraryCardVisitors(await libraryJson(request));
    const bytes = await createLibraryCards(visitors);
    return new Response(new Uint8Array(bytes), { headers: {
      // The client fetches these bytes and explicitly downloads the resulting blob.
      "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="Kartu-Pengunjung-Terpilih.pdf"',
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if (error instanceof LibraryError) return Response.json({ message: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return Response.json({ message: error.issues[0]?.message ?? "Pilihan pengunjung tidak valid." }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ message: "Pilihan pengunjung tidak valid." }, { status: 400 });
    console.error("Cetak kartu pengunjung gagal", error);
    return Response.json({ message: "Kartu gagal dibuat. Silakan coba lagi." }, { status: 500 });
  }
}
