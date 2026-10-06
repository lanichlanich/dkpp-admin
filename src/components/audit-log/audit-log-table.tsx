"use client";

import { useMemo, useState } from "react";
import { History, LoaderCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AuditLogEntry } from "@/lib/audit-logs";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Jakarta",
});

const actionLabels: Record<string, string> = {
  INSERT: "Tambah",
  UPDATE: "Ubah",
  DELETE: "Hapus",
  BATCH: "Perubahan massal",
};

export function AuditLogTable({ initialLogs, initialHasMore, initialOffset }: {
  initialLogs: AuditLogEntry[]; initialHasMore: boolean; initialOffset: number;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [offset, setOffset] = useState(initialOffset);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    if (!normalized) return logs;
    return logs.filter((item) => [
      item.actorName, item.actorUsername, item.entity, item.route, item.ipAddress,
      item.osName, item.browserName, item.deviceType, item.changedFields.join(" "),
    ].some((value) => value?.toLocaleLowerCase("id-ID").includes(normalized)));
  }, [logs, query]);

  async function loadMore() {
    setLoading(true);
    try {
      const response = await fetch(`/api/audit-logs?offset=${offset}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Log audit gagal dimuat.");
      const nextLogs = payload.logs as AuditLogEntry[];
      setLogs((current) => [...current, ...nextLogs.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setHasMore(Boolean(payload.hasMore));
      setOffset(Number(payload.nextOffset));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Log audit gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }

  return <Card>
    <CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
      <div><CardTitle>Riwayat perubahan</CardTitle><CardDescription>{logs.length} catatan dimuat. Waktu ditampilkan dalam WIB.</CardDescription></div>
      <div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Cari pengguna, data, alamat IP, atau menu" aria-label="Cari log audit" /></div>
    </CardHeader>
    <CardContent className="px-0">
      {!filteredLogs.length ? <div className="grid min-h-48 place-items-center px-6 text-center"><div>
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-indigo-50 text-indigo-600"><History className="size-5" /></span>
        <p className="mt-3 font-medium text-zinc-900">{logs.length ? "Tidak ada log yang cocok" : "Belum ada perubahan tercatat"}</p>
        <p className="mt-1 text-sm text-zinc-500">Perubahan data melalui aplikasi akan muncul di sini.</p>
      </div></div> : <div className="overflow-x-auto"><Table>
        <TableHeader><TableRow>
          <TableHead className="pl-4">Waktu (WIB)</TableHead><TableHead>Pengguna</TableHead><TableHead>Aksi dan data</TableHead>
          <TableHead>Kolom berubah</TableHead><TableHead>Alamat IP</TableHead><TableHead>Perangkat</TableHead><TableHead className="pr-4">Menu / request</TableHead>
        </TableRow></TableHeader>
        <TableBody>{filteredLogs.map((item) => <TableRow key={item.id}>
          <TableCell className="min-w-40 pl-4 align-top text-xs">{dateTimeFormatter.format(new Date(item.createdAt))}</TableCell>
          <TableCell className="min-w-36 align-top"><span className="block font-medium text-zinc-900">{item.actorName}</span>{item.actorUsername && <span className="text-xs text-zinc-500">@{item.actorUsername}</span>}</TableCell>
          <TableCell className="min-w-40 align-top"><span className="block font-medium text-zinc-900">{actionLabels[item.action] ?? item.action} · {item.entity}</span><span className="text-xs text-zinc-500">{item.affectedRows} baris · {item.operationCount} operasi</span></TableCell>
          <TableCell className="min-w-48 max-w-72 align-top"><span className="line-clamp-3 text-xs text-zinc-600">{item.changedFields.length ? item.changedFields.join(", ") : "—"}</span></TableCell>
          <TableCell className="min-w-32 align-top font-mono text-xs">{item.ipAddress ?? "Tidak tersedia"}{item.countryCode && <span className="mt-1 block font-sans text-zinc-500">{item.countryCode}{item.timezone ? ` · ${item.timezone}` : ""}</span>}</TableCell>
          <TableCell className="min-w-36 align-top"><span className="block text-sm">{item.osName} · {item.deviceType}</span><span className="text-xs text-zinc-500">{item.browserName}</span></TableCell>
          <TableCell className="min-w-40 max-w-56 pr-4 align-top"><span className="block break-all text-xs text-zinc-600">{item.route ?? "Rute tidak tersedia"}</span>{item.requestId && <span className="mt-1 block break-all font-mono text-[10px] text-zinc-400" title="ID permintaan Vercel">{item.requestId}</span>}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>}
      {hasMore && <div className="flex justify-center border-t px-4 py-4"><Button type="button" variant="outline" onClick={loadMore} disabled={loading}>{loading ? <><LoaderCircle className="animate-spin" />Memuat log...</> : "Muat lebih banyak"}</Button></div>}
    </CardContent>
  </Card>;
}
