import { checkApiAccess } from "@/lib/authorization";
import { saveLibraryBook, deleteLibraryBook } from "@/lib/library";
import { libraryJson, libraryResponse } from "@/lib/library-api";
import { readLibraryBookRequest } from "@/lib/library-book-request";
type Context = {params:Promise<{id:string}>};
export async function PATCH(request: Request, context: Context) {
  const denied = await checkApiAccess(["perpustakaan-buku"]);
  if (denied) return denied;
  return libraryResponse(async () => {
    const { values, cover } = await readLibraryBookRequest(request);
    return { id: await saveLibraryBook(values, (await context.params).id, cover) };
  });
}
export async function DELETE(request: Request, context: Context) { const denied = await checkApiAccess(["perpustakaan-buku"]); if (denied) return denied; return libraryResponse(async()=>{await deleteLibraryBook((await context.params).id,await libraryJson(request));return null;}); }
