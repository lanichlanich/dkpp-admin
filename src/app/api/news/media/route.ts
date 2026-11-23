import { checkApiAccess } from "@/lib/authorization";
import { prepareNewsImage, readNewsUpload, storeNewsImage } from "@/lib/news-media";
import { NEWS_MEDIA_PREFIX } from "@/lib/news-media-types";
import { MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

export const runtime = "nodejs";
const error = (message: string, status: number) => Response.json({ message }, { status });
export async function POST(request: Request) {
  const denied = await checkApiAccess(["berita"]);
  if (denied) return denied;
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const protocol = request.headers.get("x-forwarded-proto") || url.protocol.slice(0, -1);
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== `${protocol}://${host}`)) return error("Sumber permintaan tidak valid.", 403);
  if (!/^image\/(jpeg|png|webp)$/.test(request.headers.get("content-type") ?? "")) return error("Pilih gambar JPG, PNG, atau WebP.", 415);
  try {
    const bytes = await readNewsUpload(request);
    if (!bytes) return error(`Gambar maksimal ${MAX_UPLOAD_SIZE_MB} MB.`, 413);
    const image = await prepareNewsImage(bytes);
    if (!image) return error("Gambar tidak valid atau terlalu besar. Gunakan JPG, PNG, atau WebP non-animasi.", 415);
    return Response.json({ url: `${NEWS_MEDIA_PREFIX}${await storeNewsImage(image)}` }, { status: 201 });
  } catch (cause) {
    console.error("Gagal menyimpan gambar berita", cause);
    return error("Gambar belum tersimpan. Silakan coba lagi.", 500);
  }
}
