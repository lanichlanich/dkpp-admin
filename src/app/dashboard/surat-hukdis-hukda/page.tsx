import type { Metadata } from "next";
import { OfficialStatementForm } from "@/components/official-statements/official-statement-form";
import { OfficialStatementHistory } from "@/components/official-statements/official-statement-history";
import { getDpcpEmployeeOptions } from "@/lib/employees";
import { getOfficialStatementHistory } from "@/lib/official-statement-documents";

export const metadata: Metadata = { title: "Pembuatan Surat HUKDIS dan HUKDA" };

export default async function OfficialStatementsPage() {
  const [employees, documents] = await Promise.all([getDpcpEmployeeOptions(), getOfficialStatementHistory()]);
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date());
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm font-medium text-indigo-600">Administrasi kepegawaian</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Pembuatan Surat HUKDIS dan HUKDA</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Buat surat pernyataan berdasarkan format resmi terlampir. Identitas PNS diambil dari data pegawai, sedangkan kop, isi pernyataan, dan penanda TTE tetap dipertahankan.</p>
      </div>
      <OfficialStatementForm employees={employees} today={today} />
      <OfficialStatementHistory documents={documents} />
    </div>
  );
}
