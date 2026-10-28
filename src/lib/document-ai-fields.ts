import { normalizeDocumentDate } from "@/lib/document-date";
import { EXTRACTION_DATE_LABELS, type LocalDocumentExtractionResult } from "@/lib/local-document-ai-types";

/** Fill empty draft fields only; manual/stored values always take precedence. */
export function fillEmptyDocumentFields<T extends Record<string, string>>(current: T, result: LocalDocumentExtractionResult, keys: readonly (keyof T & string)[]) {
  const values = { ...current };
  const filled: string[] = [];
  const warnings: string[] = [];
  const dateOwner: Record<string, string> = { tglPasangan: "namaPasangan", tglNikah: "namaPasangan", tglAnak1: "namaAnak1", tglAnak2: "namaAnak2" };
  const nameKey = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
  for (const key of keys) {
    if (current[key] || !result.values[key]) continue;
    let value = result.values[key];
    if (EXTRACTION_DATE_LABELS[key]) {
      const owner = dateOwner[key];
      if (owner && current[owner] && nameKey(current[owner]) !== nameKey(result.values[owner] ?? "")) {
        warnings.push(`${EXTRACTION_DATE_LABELS[key]} tidak diisi karena nama keluarga pada dokumen belum cocok dengan nama yang Anda isi. Periksa dan isi tanggal secara manual.`);
        continue;
      }
      if (!["high", "medium"].includes(result.confidence[key])) continue;
      value = normalizeDocumentDate(value);
      if (!value) continue;
    }
    values[key] = value as T[typeof key];
    filled.push(key);
  }
  return { values, filled, warnings };
}
