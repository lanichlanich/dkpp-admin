export const PDF_TOOLS_MAX_BYTES = 20 * 1024 * 1024;
export const PDF_TOOLS_MAX_FILES = 8;
export const PDF_TOOLS_MAX_PAGES = 150;
export const PDF_TARGET_ONE_MB = 1_000_000;
export const PDF_DOCUMENTS_MENU = "pdf-tools-documents";
export const PDF_DOCUMENTS_PATH = "/dashboard/tools/daftar-dokumen";
export const pdfTools = [
  { operation: "compress", slug: "compress-pdf", label: "Compress PDF", description: "Perkecil ukuran PDF, termasuk hasil scan.", action: "Kompres PDF" },
  { operation: "merge", slug: "merge-pdf", label: "Merge PDF", description: "Gabungkan PDF dan atur urutan setiap halaman melalui pratinjau.", action: "Gabungkan PDF" },
  { operation: "split", slug: "split-pdf", label: "Split PDF", description: "Pisahkan halaman pilihan menjadi satu atau beberapa PDF.", action: "Pisahkan PDF" },
] as const;
export type PdfTool = typeof pdfTools[number];
