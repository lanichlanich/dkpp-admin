import type { Metadata } from "next";
import { WfhForm } from "@/components/wfh/wfh-form";
import { WfhHistory } from "@/components/wfh/wfh-history";
import { getWfhHistory } from "@/lib/wfh-documents";
import { WFH_TEMPLATE_YEAR } from "@/lib/wfh";

export const metadata: Metadata = { title: "Pembuatan Surat Tugas WFH" };

export default async function WfhPage() {
  const documents = await getWfhHistory();
  const currentDate = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
  const today = currentDate.startsWith(`${WFH_TEMPLATE_YEAR}-`) ? currentDate : `${WFH_TEMPLATE_YEAR}-08-04`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm font-medium text-indigo-600">Administrasi penugasan</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Pembuatan Surat Tugas WFH</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Isi tiga tag pada template resmi, buat dokumen Word dengan format asli, lalu unduh kembali dokumen yang tersimpan kapan saja.</p>
      </div>
      <WfhForm today={today} />
      <WfhHistory documents={documents} />
    </div>
  );
}
