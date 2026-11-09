import { checkApiAccess } from "@/lib/authorization";
import { getLibraryBooks, saveLibraryBook } from "@/lib/library";
import { libraryResponse } from "@/lib/library-api";
import { readLibraryBookRequest } from "@/lib/library-book-request";
export async function GET() { const denied = await checkApiAccess(["perpustakaan-buku"]); if (denied) return denied; return Response.json(await getLibraryBooks(),{headers:{"Cache-Control":"no-store"}}); }
export async function POST(request: Request) {
  const denied = await checkApiAccess(["perpustakaan-buku"]);
  if (denied) return denied;
  return libraryResponse(async () => {
    const { values, cover } = await readLibraryBookRequest(request);
    return { id: await saveLibraryBook(values, undefined, cover) };
  }, 201);
}
