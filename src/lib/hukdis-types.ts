export const hukdisSanctions = [
  { code: "written_warning", label: "Teguran Tertulis", level: "Ringan" },
  { code: "written_dissatisfaction", label: "Pernyataan Tidak Puas Secara Tertulis", level: "Ringan" },
  { code: "salary_raise_delay", label: "Penundaan Kenaikan Gaji Berkala Selama 1 (satu) Tahun", level: "Sedang" },
  { code: "promotion_delay", label: "Penundaan Kenaikan Pangkat Selama 1 (satu) Tahun", level: "Sedang" },
  { code: "demotion_medium", label: "Penurunan Pangkat Setingkat Lebih Rendah Selama 1 (satu) Tahun", level: "Sedang" },
  { code: "demotion_heavy", label: "Penurunan Pangkat Setingkat Lebih Rendah Selama 1 (satu) Tahun", level: "Berat" },
  { code: "position_transfer", label: "Pemindahan Dalam Rangka Penurunan Jabatan Setingkat Lebih Rendah", level: "Berat" },
  { code: "dismissal_from_position", label: "Pembebasan Dari Jabatan", level: "Berat" },
] as const;

export type HukdisSanctionCode = (typeof hukdisSanctions)[number]["code"];

export type HukdisRecord = {
  employeeNip: string;
  reportPeriod: string;
  sanctionCode: HukdisSanctionCode;
  decisionNumber: string;
  decisionDate: string;
};
