import { checkApiAccess } from "@/lib/authorization";
import { getLibraryBooks, saveLibraryBook } from "@/lib/library";
import { libraryJson, libraryResponse } from "@/lib/library-api";
export async function GET() { const denied = await checkApiAccess(["perpustakaan-buku"]); if (denied) return denied; return Response.json(await getLibraryBooks(),{headers:{"Cache-Control":"no-store"}}); }
export async function POST(request: Request) { const denied = await checkApiAccess(["perpustakaan-buku"]); if (denied) return denied; return libraryResponse(async()=>({id:await saveLibraryBook(await libraryJson(request))}),201); }
