import { checkApiAccess } from "@/lib/authorization";
import { isPublishedNewsImage } from "@/lib/news";
import { readNewsImage } from "@/lib/news-media";
import { newsMediaNamePattern } from "@/lib/news-media-types";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const missing = () => new Response(null, { status: 404, headers });
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!newsMediaNamePattern.test(name)) return missing();
  if (!(await isPublishedNewsImage(name)) && await checkApiAccess(["berita"])) return missing();
  try {
    return new Response(new Uint8Array(await readNewsImage(name)), { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch { return missing(); }
}
