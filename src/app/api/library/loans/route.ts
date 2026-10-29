import { checkApiAccess } from "@/lib/authorization";
import { addLibraryLoan, getLibraryLoans } from "@/lib/library";
import { libraryJson, libraryResponse } from "@/lib/library-api";
export async function GET() { const denied = await checkApiAccess(["perpustakaan-peminjaman"]); if (denied) return denied; return Response.json(await getLibraryLoans(),{headers:{"Cache-Control":"no-store"}}); }
export async function POST(request: Request) { const denied = await checkApiAccess(["perpustakaan-peminjaman"]); if (denied) return denied; return libraryResponse(async()=>({id:await addLibraryLoan(await libraryJson(request))}),201); }
