"use client";

import { useState } from "react";
import { FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatIndonesianDate } from "@/lib/kgb";
import type { KgbDocumentHistory } from "@/lib/kgb-documents";
import { displayKgbLetterNumber } from "@/lib/letter-classification";
import { KgbDocumentActions } from "./kgb-document-actions";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});
const pageSize = 10;
const statuses = {
  signed: { label: "SK TTD tersedia", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  previous: { label: "SK TTD versi lama", className: "border-amber-200 bg-amber-50 text-amber-900" },
  draft: { label: "Belum upload SK TTD", className: "border-zinc-200 bg-zinc-50 text-zinc-700" },
};

function signedStatus(document: KgbDocumentHistory): keyof typeof statuses {
  if (document.signedDocuments.some(file => file.documentRevision === document.revision)) return "signed";
  return document.signedDocuments.length ? "previous" : "draft";
}

export function KgbHistory({ documents }: { documents: KgbDocumentHistory[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const search = query.trim().toLocaleLowerCase("id-ID");
  const matches = documents.filter(document => {
    if (filter !== "all" && signedStatus(document) !== filter) return false;
    const searchable = [document.employeeName, document.employeeNip, document.nomorSurat, displayKgbLetterNumber(document.nomorSurat)];
    return searchable.some(value => value.toLocaleLowerCase("id-ID").includes(search));
  });
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const activePage = Math.min(page, pages);

  return (
    <Card className="@container gap-0 py-0">
      <CardHeader className="gap-3 p-4 sm:p-5">
        <div>
          <CardTitle><h2>Daftar Dokumen SK KGB</h2></CardTitle>
          <CardDescription className="mt-1">Unduh Word, edit arsip, atau kelola PDF bertanda tangan.</CardDescription>
        </div>
        {documents.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
              <Input aria-label="Cari arsip SK KGB" placeholder="Cari nama, NIP, atau nomor surat…" value={query}
                onChange={event => { setQuery(event.target.value); setPage(1); }} className="h-10 pl-9" />
            </div>
            <select aria-label="Filter status SK KGB" value={filter}
              onChange={event => { setFilter(event.target.value); setPage(1); }}
              className="h-10 rounded-lg border border-input bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-indigo-500">
              <option value="all">Semua status</option>
              {Object.entries(statuses).map(([value, status]) => <option key={value} value={value}>{status.label}</option>)}
            </select>
          </div>
        )}
      </CardHeader>
      <CardContent className="border-t px-0">
        {matches.length === 0 ? (
          <div className="grid min-h-44 place-items-center px-6 py-5 text-center">
            <div>
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-indigo-50 text-indigo-600"><FileText className="size-5" /></span>
              <p className="mt-3 font-medium text-zinc-900">{documents.length ? "Arsip tidak ditemukan" : "Belum ada dokumen SK KGB"}</p>
              {documents.length ? (
                <Button type="button" variant="link" size="sm" onClick={() => { setQuery(""); setFilter("all"); setPage(1); }}>Reset pencarian dan filter</Button>
              ) : <p className="mt-1 text-sm text-zinc-500">Pilih Tambah SK KGB untuk membuat dokumen pertama.</p>}
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {matches.slice((activePage - 1) * pageSize, activePage * pageSize).map(document => {
              const status = statuses[signedStatus(document)];
              return (
                <li key={document.id} className="grid gap-3 px-4 py-4 @2xl:grid-cols-[minmax(0,1fr)_auto] @2xl:items-center sm:px-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700 sm:grid" aria-hidden="true"><FileText className="size-5" /></span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="break-words font-semibold text-zinc-950">{document.employeeName}</h3>
                        <Badge variant="outline" className={status.className}>{status.label}</Badge>
                      </div>
                      <p className="font-mono text-xs text-zinc-600">{document.employeeNip}</p>
                      <p className="break-words text-sm text-zinc-700">{displayKgbLetterNumber(document.nomorSurat)} · {formatIndonesianDate(document.tglSurat)}</p>
                      <p className="text-xs leading-5 text-zinc-500" title={document.fileName}>
                        Word v{document.revision} · Dibuat {dateTimeFormatter.format(new Date(document.createdAt))} oleh {document.createdBy}
                        {document.updatedAt && ` · Diedit ${dateTimeFormatter.format(new Date(document.updatedAt))}`}
                      </p>
                    </div>
                  </div>
                  <KgbDocumentActions key={document.revision} document={document} />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      {documents.length > 0 && (
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-zinc-600 sm:px-5">
          <span aria-live="polite">{matches.length} dari {documents.length} dokumen{pages > 1 && ` · Halaman ${activePage} dari ${pages}`}</span>
          {pages > 1 && <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={activePage === 1} onClick={() => setPage(activePage - 1)}>Sebelumnya</Button>
            <Button type="button" variant="outline" size="sm" disabled={activePage === pages} onClick={() => setPage(activePage + 1)}>Berikutnya</Button>
          </div>}
        </footer>
      )}
    </Card>
  );
}
