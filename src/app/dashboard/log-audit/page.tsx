import type { Metadata } from "next";
import { AuditLogTable } from "@/components/audit-log/audit-log-table";
import { listAuditLogs } from "@/lib/audit-logs";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Log Audit Perubahan Data" };

export default async function AuditLogPage() {
  await requireUser();
  const page = await listAuditLogs();
  return <div className="mx-auto max-w-7xl space-y-6">
    <div>
      <p className="text-sm font-medium text-indigo-600">Keamanan dan akuntabilitas</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Log Audit Perubahan Data</h1>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500">Catatan otomatis atas penambahan, perubahan, dan penghapusan data melalui aplikasi. Nilai data pegawai tidak disalin ke log; yang dicatat adalah jenis entitas dan kolom yang berubah.</p>
    </div>
    <AuditLogTable initialLogs={page.logs} initialHasMore={page.hasMore} initialOffset={page.nextOffset} />
  </div>;
}
