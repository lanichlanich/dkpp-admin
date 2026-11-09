import type { Metadata } from "next";
import { getLibraryBooks } from "@/lib/library";
import { requireMenuAccess } from "@/lib/authorization";
import { BooksAdmin } from "@/components/library/books-admin";
import { LibraryAdminHeader } from "@/components/library/admin-shared";
import { LibraryReportDownloads } from "@/components/library/report-downloads";
export const metadata: Metadata = { title: "Daftar Buku" };
export default async function BooksPage() {
  await requireMenuAccess("perpustakaan-buku");
  const books = await getLibraryBooks();
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <LibraryAdminHeader title="Daftar Buku" description="Kelola inventaris, lokasi rak, dan ketersediaan koleksi yang ditampilkan di perpustakaan publik." />
      <LibraryReportDownloads kind="books" />
      <BooksAdmin books={books} />
    </div>
  );
}
