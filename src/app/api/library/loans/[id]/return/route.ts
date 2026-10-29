import { checkApiAccess } from "@/lib/authorization";
import { returnLibraryLoan } from "@/lib/library";
import { libraryJson, libraryResponse } from "@/lib/library-api";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) { const denied=await checkApiAccess(["perpustakaan-peminjaman"]);if(denied)return denied;return libraryResponse(async()=>{await returnLibraryLoan((await params).id,await libraryJson(request));return null;}); }
