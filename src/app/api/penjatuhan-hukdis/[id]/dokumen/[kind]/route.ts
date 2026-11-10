import { z } from "zod";
import { checkApiAccess } from "@/lib/authorization";
import { disciplineDocuments, DISCIPLINE_MENU } from "@/lib/discipline-case";
import { disciplineCaseResponse } from "@/lib/discipline-case-api";
import { DisciplineCaseError, getDisciplineCase } from "@/lib/discipline-cases";
import { generateDisciplineDocument } from "@/lib/discipline-document";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const denied = await checkApiAccess([DISCIPLINE_MENU]);
  if (denied) return denied;
  return disciplineCaseResponse(async () => {
    const { id, kind } = await params;
    const template = disciplineDocuments.find(item => item.id === kind);
    if (!template || !z.uuid().safeParse(id).success) throw new DisciplineCaseError("Format atau perkara tidak ditemukan.", 404);
    const record = await getDisciplineCase(id);
    if (!record) throw new DisciplineCaseError("Perkara tidak ditemukan.", 404);
    const document = await generateDisciplineDocument(record, template.id);
    return new Response(new Uint8Array(document.bytes), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  });
}
