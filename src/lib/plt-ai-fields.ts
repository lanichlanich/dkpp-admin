import { pltSchema, type PltInput } from "@/lib/plt-dates";
import type { LocalDocumentExtractionResult } from "@/lib/local-document-ai-types";
import { normalizeDocumentDate } from "@/lib/document-date";

export const PLT_AI_FIELDS = { skNumber: "Nomor SK", actingPosition: "Jabatan Plt.", actingUnit: "Unit kerja Plt.", startDate: "Tanggal mulai" } as const;

export function applyPltExtraction(current: PltInput, result: LocalDocumentExtractionResult, edited: ReadonlySet<keyof PltInput>, linked: boolean) {
  const values = { ...current };
  const filled: string[] = [];
  for (const key of Object.keys(PLT_AI_FIELDS) as Array<keyof typeof PLT_AI_FIELDS>) {
    if (edited.has(key) || (linked && (key === "actingPosition" || key === "actingUnit"))) continue;
    if (key === "startDate") values.startDate = "";
    if (!result.values[key] || result.confidence[key] === "low") continue;
    if (key === "startDate" && !["high", "medium"].includes(result.confidence[key])) continue;
    const parsed = pltSchema.shape[key].safeParse(key === "startDate" ? normalizeDocumentDate(result.values[key]) : result.values[key]);
    if (!parsed.success) continue;
    values[key] = parsed.data;
    filled.push(PLT_AI_FIELDS[key]);
  }
  return { values, filled };
}
