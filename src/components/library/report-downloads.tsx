import { FileSpreadsheet, FileText } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LibraryReportKind } from "@/lib/library-report-types";

export function LibraryReportDownloads({ kind, currentMonth }: { kind: LibraryReportKind; currentMonth?: string }) {
  const endpoint = `/api/library/reports/${kind}`;
  const monthly = kind === "loans";

  return (
    <section aria-labelledby="library-report-title" className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
      <div>
        <h2 id="library-report-title" className="font-semibold text-emerald-950">
          {monthly ? "Laporan Peminjaman Bulanan" : kind === "books" ? "Ekspor Daftar Buku" : "Ekspor Daftar Pengunjung"}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          {monthly ? "Pilih bulan berdasarkan tanggal pinjam. Status mengikuti data saat diunduh." : "Unduh seluruh daftar, termasuk data nonaktif."}
        </p>
      </div>
      {monthly ? (
        <form method="get" action={endpoint} className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          <label className="grid gap-1.5 text-sm font-medium">
            Bulan laporan
            <Input type="month" name="month" defaultValue={currentMonth} min="1900-01" max="2199-12"
              pattern="[0-9]{4}-[0-9]{2}" placeholder="YYYY-MM" required className="h-9 w-44 bg-white" />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="format" value="pdf" variant="outline" className="text-rose-800"><FileText />Unduh PDF</Button>
            <Button type="submit" name="format" value="xlsx" variant="outline" className="text-emerald-800"><FileSpreadsheet />Unduh Excel</Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <a download href={`${endpoint}?format=pdf`} className={buttonVariants({ variant: "outline", className: "text-rose-800" })}><FileText />Unduh PDF</a>
          <a download href={`${endpoint}?format=xlsx`} className={buttonVariants({ variant: "outline", className: "text-emerald-800" })}><FileSpreadsheet />Unduh Excel</a>
        </div>
      )}
    </section>
  );
}
