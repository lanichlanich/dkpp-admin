import { checkApiAccess } from "@/lib/authorization";
import { addLibraryVisit, getLibraryVisits } from "@/lib/library";
import { libraryJson, libraryResponse } from "@/lib/library-api";
export async function GET() { const denied = await checkApiAccess(["perpustakaan-pengunjung"]); if (denied) return denied; return Response.json(await getLibraryVisits(),{headers:{"Cache-Control":"no-store"}}); }
export async function POST(request: Request) { const denied = await checkApiAccess(["perpustakaan-pengunjung"]); if (denied) return denied; return libraryResponse(async()=>({id:await addLibraryVisit(await libraryJson(request))}),201); }
