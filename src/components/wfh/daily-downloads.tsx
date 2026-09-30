import { FileDown, FileSpreadsheet } from "lucide-react";

type DailyTotal = { date: string; wfh: number; wfo: number };

function DownloadLinks({ period, day, status }: { period: string; day: DailyTotal; status: "WFH" | "WFO" }) {
  const base = `/api/wfh-schedule/${period}/daily/${day.date}/${status}`;
  return <div className="flex flex-wrap gap-2">
    <a href={`${base}/pdf`} aria-label={`Unduh daftar ${status} PDF ${day.date}`} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-zinc-50"><FileDown className="size-3.5" />PDF</a>
    <a href={`${base}/xlsx`} aria-label={`Unduh daftar ${status} Excel ${day.date}`} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-zinc-50"><FileSpreadsheet className="size-3.5" />Excel</a>
  </div>;
}

export function DailyDownloads({ period, totals }: { period: string; totals: DailyTotal[] }) {
  return <div className="overflow-hidden rounded-xl border bg-white">
    <div className="border-b p-4"><h2 className="font-semibold">Unduh daftar per tanggal</h2><p className="mt-1 text-xs text-zinc-500">Daftar WFH dan WFO diunduh terpisah untuk setiap Jumat. Berkas mengikuti status yang terakhir disimpan.</p></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[610px] text-left text-sm">
      <thead className="bg-emerald-50"><tr><th className="p-3">Tanggal</th><th className="p-3">WFH</th><th className="p-3">Daftar WFH</th><th className="p-3">WFO</th><th className="p-3">Daftar WFO</th></tr></thead>
      <tbody>{totals.map((day) => <tr key={day.date} className="border-t">
        <td className="whitespace-nowrap p-3">{new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day.date}T00:00:00Z`))}</td>
        <td className="p-3 font-semibold text-emerald-700">{day.wfh}</td><td className="p-3"><DownloadLinks period={period} day={day} status="WFH" /></td>
        <td className="p-3 font-semibold text-sky-700">{day.wfo}</td><td className="p-3"><DownloadLinks period={period} day={day} status="WFO" /></td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}
