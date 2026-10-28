export const LOCAL_DOCUMENT_EXTRACTION_KINDS = ["employee-document", "dpcp", "official-archive", "plt-assignment"] as const;

export type LocalDocumentExtractionKind = (typeof LOCAL_DOCUMENT_EXTRACTION_KINDS)[number];
export type ExtractionConfidence = "high" | "medium" | "low";

export const EXTRACTION_DATE_LABELS: Record<string, string> = {
  tglSurat: "Tanggal penetapan/penerbitan surat", tmtSurat: "TMT surat", tmtpns: "TMT PNS",
  tglPasangan: "Tanggal lahir pasangan", tglNikah: "Tanggal pernikahan",
  tglAnak1: "Tanggal lahir anak pertama", tglAnak2: "Tanggal lahir anak kedua",
  tglDokumen: "Tanggal penetapan/penerbitan dokumen", startDate: "Tanggal mulai/TMT Plt.",
};

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

export const OFFICIAL_ARCHIVE_EXTRACTION_FIELDS = ["namaDokumen", "nomor", "jenisDokumen", "tglDokumen"] as const;

export const PLT_ASSIGNMENT_EXTRACTION_FIELDS = ["employeeName", "employeeNip", "skNumber", "actingPosition", "actingUnit", "startDate"] as const;
