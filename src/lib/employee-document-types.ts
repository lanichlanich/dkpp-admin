export const EMPLOYEE_DOCUMENT_TYPES = [
  "sk_cpns",
  "sk_pns_pertama",
  "sk_kontrak_pppk",
  "dokumen_lainnya",
  "sasaran_kinerja_pegawai",
] as const;

export type EmployeeDocumentType = (typeof EMPLOYEE_DOCUMENT_TYPES)[number];

export const EMPLOYEE_DOCUMENT_TYPE_LABELS: Record<EmployeeDocumentType, string> = {
  sk_cpns: "SK CPNS",
  sk_pns_pertama: "SK PNS Pertama",
  sk_kontrak_pppk: "SK Kontrak PPPK",
  dokumen_lainnya: "Dokumen Lainnya",
  sasaran_kinerja_pegawai: "Sasaran Kinerja Pegawai",
};

export const SKP_ASSESSMENT_VALUES = [
  "SESUAI EKSPEKTASI",
  "DIATAS EKSPEKTASI",
  "DIBAWAH EKSPEKTASI",
] as const;

export type SkpAssessment = (typeof SKP_ASSESSMENT_VALUES)[number];

export const SKP_PREDICATE_VALUES = ["BAIK", "SANGAT BAIK", "KURANG"] as const;

export type SkpPredicate = (typeof SKP_PREDICATE_VALUES)[number];

export function getAllowedEmployeeDocumentTypes(asnType: string): EmployeeDocumentType[] {
  const normalized = asnType.trim().toUpperCase();
  if (normalized === "PNS") return ["sk_cpns", "sk_pns_pertama", "dokumen_lainnya", "sasaran_kinerja_pegawai"];
  if (normalized === "PPPK" || normalized === "PPPK PW") return ["sk_kontrak_pppk", "dokumen_lainnya", "sasaran_kinerja_pegawai"];
  return ["dokumen_lainnya", "sasaran_kinerja_pegawai"];
}

export function employeeDocumentNeedsServicePeriod(documentType: EmployeeDocumentType) {
  return documentType === "sk_cpns" || documentType === "sk_pns_pertama";
}

export function employeeDocumentIsSkp(documentType: EmployeeDocumentType | "") {
  return documentType === "sasaran_kinerja_pegawai";
}
