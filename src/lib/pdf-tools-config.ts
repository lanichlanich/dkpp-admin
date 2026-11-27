export const PDF_TOOLS_MAX_BYTES = 20 * 1024 * 1024;
export const PDF_TOOLS_MAX_FILES = 8;
export const pdfTools = [
  { operation: "compress", slug: "compress-pdf", label: "Compress PDF", description: "Perkecil ukuran PDF, termasuk hasil scan.", action: "Kompres PDF" },
  { operation: "merge", slug: "merge-pdf", label: "Merge PDF", description: "Gabungkan beberapa PDF sesuai urutan yang Anda tentukan.", action: "Gabungkan PDF" },
  { operation: "split", slug: "split-pdf", label: "Split PDF", description: "Pisahkan halaman pilihan menjadi satu atau beberapa PDF.", action: "Pisahkan PDF" },
] as const;
export type PdfTool = typeof pdfTools[number];
