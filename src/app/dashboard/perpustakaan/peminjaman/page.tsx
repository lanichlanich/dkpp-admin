import type { Metadata } from "next";
import { getLibraryLoans, getLibraryLoanOptions } from "@/lib/library";
import { requireMenuAccess } from "@/lib/authorization";
import { jakartaToday } from "@/lib/plt-dates";
import { LoansAdmin } from "@/components/library/loans-admin";
import { LibraryAdminHeader } from "@/components/library/admin-shared";
export const metadata: Metadata = { title: "Daftar Peminjaman Buku" };
export default async function LoansPage() {
  await requireMenuAccess("perpustakaan-peminjaman");
  const [loans, options] = await Promise.all([getLibraryLoans(),getLibraryLoanOptions()]);
  return <div className="mx-auto max-w-7xl space-y-6"><LibraryAdminHeader title="Daftar Peminjaman" description="Catat peminjaman dan pengembalian buku, pantau jatuh tempo, serta periksa peminjaman yang terlambat." /><LoansAdmin loans={loans} {...options} today={jakartaToday()} /></div>;
}
