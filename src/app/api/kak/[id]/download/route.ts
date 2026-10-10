import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getKakDownload } from "@/lib/kak";
import { downloadStorageObject } from "@/lib/storage";
import { kakBundleFileName } from "@/lib/kak-file-metadata";
import PizZip from "pizzip";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getCurrentUser()) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const variant = query.get("source");
  const bundle = query.get("format") === "zip";
  if ((variant && !["rka", "po", "kak"].includes(variant)) || (query.get("format") && !bundle) || (bundle && variant)) return NextResponse.json({ error: "Pilihan dokumen tidak valid." }, { status: 400 });
  const source = variant === "rka";
  const id = (await context.params).id;
  const row = await getKakDownload(id, variant === "po" ? "po" : source);
  if (!row) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  try {
    let bytes: Buffer = await downloadStorageObject(row.storageName, row.filePath);
    let fileName = row.fileName;
    if (bundle) {
      const po = await getKakDownload(id, "po");
      if (!po) return NextResponse.json({ error: "PO belum tersedia pada arsip ini. Generate ulang RKA untuk membuat PO dan KAK." }, { status: 404 });
      const zip = new PizZip();
      zip.file(row.fileName, bytes);
      zip.file(po.fileName, await downloadStorageObject(po.storageName, po.filePath));
      bytes = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
      fileName = kakBundleFileName(row.fileName);
    }
    return new NextResponse(new Uint8Array(bytes), { headers: {
      "content-type": bundle ? "application/zip" : source ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${bundle ? "PO-dan-KAK.zip" : source ? "RKA.pdf" : "Dokumen.docx"}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "cache-control": "private, no-store", "x-content-type-options": "nosniff",
    } });
  } catch { return NextResponse.json({ error: "Dokumen gagal diunduh. Silakan coba lagi." }, { status: 502 }); }
}
