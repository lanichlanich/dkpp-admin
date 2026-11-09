import type { Metadata } from "next";
import { getLibraryLoans, getLibraryLoanOptions } from "@/lib/library";
import { requireMenuAccess } from "@/lib/authorization";
import { jakartaToday } from "@/lib/plt-dates";
import { LoansAdmin } from "@/components/library/loans-admin";
import { LibraryAdminHeader } from "@/components/library/admin-shared";
import { LibraryReportDownloads } from "@/components/library/report-downloads";
export const metadata: Metadata = { title: "Daftar Peminjaman Buku" };
export default async function LoansPage() {
  await requireMenuAccess("perpustakaan-peminjaman");
  const [loans, options] = await Promise.all([getLibraryLoans(),getLibraryLoanOptions()]);
  const today = jakartaToday();
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <LibraryAdminHeader title="Daftar Peminjaman" description="Catat peminjaman dan pengembalian buku, pantau jatuh tempo, serta periksa peminjaman yang terlambat." />
      <LibraryReportDownloads kind="loans" currentMonth={today.slice(0, 7)} />
      <LoansAdmin loans={loans} {...options} today={today} />
    </div>
  );
}
