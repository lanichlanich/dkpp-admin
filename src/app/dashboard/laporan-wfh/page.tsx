import type { Metadata } from "next";
import { FileDown } from "lucide-react";
import { WfhReportForm } from "@/components/wfh/wfh-report-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/session";
import { getReportEmployees, getReportHistory } from "@/lib/wfh-report-store";

export const metadata: Metadata = { title: "Laporan WFH" };
export default async function WfhReportPage() {
  const user = await requireUser();
  const history = getReportHistory(user.id);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <div className="mx-auto max-w-5xl space-y-6"><div><p className="text-sm font-medium text-indigo-600">Administrasi pegawai</p><h1 className="mt-1 text-2xl font-semibold">Laporan Kinerja WFH</h1><p className="mt-2 text-sm text-zinc-500">Susun laporan harian sesuai jabatan dan unit kerja menggunakan format Pelaporan Kinerja WFH ASN.</p></div>
    <WfhReportForm employees={getReportEmployees()} today={today} aiReady={Boolean(process.env.GEMINI_API_KEY)} />
    <Card><CardHeader><CardTitle>Arsip laporan WFH</CardTitle><CardDescription>Laporan yang Anda buat dapat diunduh kembali di sini.</CardDescription></CardHeader><CardContent>{history.length === 0 ? <p className="py-5 text-sm text-zinc-500">Belum ada laporan WFH.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Tanggal WFH</th><th className="p-3">Pegawai</th><th className="p-3">Dokumen</th></tr></thead><tbody>{history.map(row => <tr key={row.id} className="border-b last:border-0"><td className="whitespace-nowrap p-3">{row.report_date}</td><td className="p-3">{row.employee_name}</td><td className="p-3"><a className="inline-flex items-center gap-2 whitespace-nowrap text-indigo-700 hover:underline" href={`/api/wfh-reports/${row.id}/download`}><FileDown className="size-4" />Unduh DOCX</a></td></tr>)}</tbody></table></div>}</CardContent></Card>
  </div>;
}
