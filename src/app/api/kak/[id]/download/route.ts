import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getKakDownload } from "@/lib/kak";
import { downloadStorageObject } from "@/lib/storage";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getCurrentUser()) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const source = new URL(request.url).searchParams.get("source") === "rka";
  const row = await getKakDownload((await context.params).id, source);
  if (!row) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  try {
    const bytes = await downloadStorageObject(row.storageName, row.filePath);
    return new NextResponse(new Uint8Array(bytes), { headers: {
      "content-type": source ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${source ? "RKA.pdf" : row.fileName}"; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
      "cache-control": "private, no-store", "x-content-type-options": "nosniff",
    } });
  } catch { return NextResponse.json({ error: "Dokumen gagal diunduh. Silakan coba lagi." }, { status: 502 }); }
}
