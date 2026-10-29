import { checkApiAccess } from "@/lib/authorization";
import { saveLibraryBook, deleteLibraryBook } from "@/lib/library";
import { libraryJson, libraryResponse } from "@/lib/library-api";
type Context = {params:Promise<{id:string}>};
export async function PATCH(request: Request, context: Context) { const denied = await checkApiAccess(["perpustakaan-buku"]); if (denied) return denied; return libraryResponse(async()=>({id:await saveLibraryBook(await libraryJson(request),(await context.params).id)})); }
export async function DELETE(request: Request, context: Context) { const denied = await checkApiAccess(["perpustakaan-buku"]); if (denied) return denied; return libraryResponse(async()=>{await deleteLibraryBook((await context.params).id,await libraryJson(request));return null;}); }
