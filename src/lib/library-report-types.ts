export const libraryReportMenus = {
  books: "perpustakaan-buku",
  visitors: "perpustakaan-pengunjung",
  loans: "perpustakaan-peminjaman",
} as const;

export type LibraryReportKind = keyof typeof libraryReportMenus;
