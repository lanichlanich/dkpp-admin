import { normalizeDocumentDate } from "@/lib/document-date";
import { EXTRACTION_DATE_LABELS, type LocalDocumentExtractionResult } from "@/lib/local-document-ai-types";

/** Fill empty draft fields only; manual/stored values always take precedence. */
export function fillEmptyDocumentFields<T extends Record<string, string>>(current: T, result: LocalDocumentExtractionResult, keys: readonly (keyof T & string)[]) {
  const values = { ...current };
  const filled: string[] = [];
  for (const key of keys) {
    if (current[key] || !result.values[key]) continue;
    let value = result.values[key];
    if (EXTRACTION_DATE_LABELS[key]) {
      if (!["high", "medium"].includes(result.confidence[key])) continue;
      value = normalizeDocumentDate(value);
      if (!value) continue;
    }
    values[key] = value as T[typeof key];
    filled.push(key);
  }
  return { values, filled };
}
