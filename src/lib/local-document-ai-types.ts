export const LOCAL_DOCUMENT_EXTRACTION_KINDS = ["employee-document", "dpcp"] as const;

export type LocalDocumentExtractionKind = (typeof LOCAL_DOCUMENT_EXTRACTION_KINDS)[number];
export type ExtractionConfidence = "high" | "medium" | "low";

export type LocalDocumentSource = {
  fileName: string;
  method: "text" | "ocr" | "text+ocr" | "gemini";
  pageCount?: number;
};

export type LocalDocumentExtractionResult = {
  values: Record<string, string>;
  confidence: Record<string, ExtractionConfidence>;
  warnings: string[];
  sources: LocalDocumentSource[];
  model: string;
  localOnly: boolean;
};

export const EMPLOYEE_DOCUMENT_EXTRACTION_FIELDS = [
  "nomorSurat",
  "tglSurat",
  "tmtSurat",
  "masaKerja",
] as const;

export const DPCP_EXTRACTION_FIELDS = [
  "bup",
  "tempatLahir",
  "gaji",
  "mkg",
  "mkp",
  "mksp",
  "pendidikan1",
  "tmtpns",
  "namaPasangan",
  "tglPasangan",
  "tglNikah",
  "pasanganKe",
  "namaAnak1",
  "tglAnak1",
  "statusAnak1",
  "orangTuaAnak1",
  "namaAnak2",
  "tglAnak2",
  "statusAnak2",
  "orangTuaAnak2",
  "alamatPensiun",
] as const;
