import { saveDisciplineCaseRequest } from "@/lib/discipline-case-api";
export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return saveDisciplineCaseRequest(request, (await params).id);
}
