import { checkApiAccess } from "@/lib/authorization";
import { LibraryError, getLibraryVisitor } from "@/lib/library";
import { createLibraryCard } from "@/lib/library-card";
export const runtime = "nodejs";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const denied=await checkApiAccess(["perpustakaan-pengunjung"]);if(denied)return denied;
  try {
    const visitor=await getLibraryVisitor((await params).id);
    const bytes=await createLibraryCard(visitor);
    return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="Kartu-Pengunjung-${visitor.cardNumber}.pdf"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch(error) {
    if(error instanceof LibraryError)return Response.json({message:error.message},{status:error.status});
    console.error("Kartu perpustakaan gagal dibuat",error);return Response.json({message:"Kartu gagal dibuat."},{status:500});
  }
}
