import { checkApiAccess } from "@/lib/authorization";
import { getLibraryBookCover } from "@/lib/library";
import { readLibraryCover } from "@/lib/library-cover";
import { LIBRARY_COVER_MIME, libraryCoverNamePattern } from "@/lib/library-cover-types";

export const runtime = "nodejs";

function unavailable() {
  return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const book = await getLibraryBookCover((await params).id);
  const name = book?.coverStorageName;
  if (!name || !libraryCoverNamePattern.test(name)) return unavailable();
  if (!book.isActive && await checkApiAccess(["perpustakaan-buku"])) return unavailable();

  const version = new URL(request.url).searchParams.get("v");
  if (version !== null && version !== name) return unavailable();
  const etag = `"${name}"`;
  const headers = { "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff", ETag: etag };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  try {
    const bytes = await readLibraryCover(name);
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": LIBRARY_COVER_MIME } });
  } catch (error) {
    console.error("Cover buku tidak dapat dibaca", error);
    return unavailable();
  }
}
