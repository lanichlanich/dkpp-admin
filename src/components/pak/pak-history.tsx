"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PakDocumentHistory } from "@/lib/pak-documents";
import { formatCredit } from "@/lib/pak";
import { formatIndonesianDate } from "@/lib/kgb";

export function PakHistory({ documents }: { documents: PakDocumentHistory[] }) {
  const [query, setQuery] = useState("");
  const filtered = documents.filter((d) => `${d.employeeName} ${d.employeeNip} ${d.nomor} ${d.period} ${d.employeeStatus}`.toLowerCase().includes(query.toLowerCase()));
  return <Card><CardHeader><CardTitle>Daftar dokumen PAK ({documents.length})</CardTitle><Input aria-label="Cari arsip PAK" placeholder="Cari nama, NIP, nomor, periode, atau status..." value={query} onChange={(e) => setQuery(e.target.value)} className="mt-3 max-w-lg" /></CardHeader><CardContent>{filtered.length === 0 ? <p className="py-6 text-sm text-zinc-500">{documents.length === 0 ? "Belum ada dokumen PAK yang dibuat." : "Dokumen tidak ditemukan."}</p> : <Table><TableHeader><TableRow><TableHead>Pegawai</TableHead><TableHead>Nomor / penetapan</TableHead><TableHead>Periode</TableHead><TableHead>AK kumulatif</TableHead><TableHead>Dibuat oleh</TableHead><TableHead>Dokumen</TableHead></TableRow></TableHeader><TableBody>{filtered.map((d) => <TableRow key={d.id}><TableCell><p className="font-medium">{d.employeeName}</p><p className="text-xs text-zinc-500">{d.employeeNip} · {d.employeeStatus}</p></TableCell><TableCell><p>{d.nomor}</p><p className="text-xs text-zinc-500">{formatIndonesianDate(d.tanggal)}</p></TableCell><TableCell>{d.period}</TableCell><TableCell>{formatCredit(d.total)}</TableCell><TableCell><p>{d.createdBy}</p><p className="text-xs text-zinc-500">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(d.createdAt))}</p></TableCell><TableCell><a href={`/api/pak/${d.id}/download`} className={buttonVariants({ variant: "outline", size: "sm" })}><Download />Unduh</a></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>;
}
