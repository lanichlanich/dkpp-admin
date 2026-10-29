import { checkApiAccess } from "@/lib/authorization";
import { saveLibraryVisitor } from "@/lib/library";
import { libraryJson, libraryResponse } from "@/lib/library-api";
export async function PATCH(request: Request, {params}: {params:Promise<{id:string}>}) { const denied = await checkApiAccess(["perpustakaan-pengunjung"]); if (denied) return denied; return libraryResponse(async()=>({id:await saveLibraryVisitor(await libraryJson(request),(await params).id)})); }
