"use client";

import { useRef, useState } from "react";
import { ExternalLink, LoaderCircle, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { legalSearchInput, legalSearchResult } from "@/lib/surat-tugas-legal-validation";
import type { z } from "zod";

type Results = z.infer<typeof legalSearchResult>["results"];
export function SuratTugasLegalSearch({ entries, add }: { entries: string[]; add: (text: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const full = entries.length >= 8 && entries.every(text => text.trim());

  async function search() {
    if (busy.current) return;
    setError(""); setResults(undefined);
    const input = legalSearchInput.safeParse({ query });
    if (!input.success) { setError("Isi 5–160 karakter, tanpa NIP, email, atau tautan."); return; }
    busy.current = true; setPending(true);
    try {
      const response = await fetch("/api/surat-tugas/search-dasar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message ?? "Pencarian belum tersedia.");
      const parsed = legalSearchResult.safeParse(data);
      if (!parsed.success) throw new Error("Respons pencarian tidak sesuai format.");
      setResults(parsed.data.results);
    } catch (err) { setError(err instanceof Error ? err.message : "Pencarian gagal."); }
    finally { busy.current = false; setPending(false); }
  }
  return <section aria-label="Cari dasar hukum" aria-busy={pending} className="min-w-0 space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
    <label className="grid gap-1.5 text-sm font-semibold">Cari dasar hukum
      <Input type="search" value={query} maxLength={160} disabled={pending} placeholder="Contoh: Perbup Indramayu 30 Tahun 2024" onChange={event => { setQuery(event.target.value); setResults(undefined); setError(""); }} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void search(); } }}/>
    </label>
    <p className="text-xs text-muted-foreground">Pencarian OpenAI dibatasi ke situs peraturan pemerintah. Masukkan kata kunci publik saja; periksa judul, status, dan kesesuaian peraturan sebelum dipakai.</p>
    <Button type="button" variant="outline" onClick={search} disabled={pending || !query.trim()}>{pending ? <LoaderCircle className="animate-spin" aria-hidden/> : <Search aria-hidden/>}{pending ? "Mencari sumber resmi…" : "Cari peraturan"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {results && <p role="status" className="text-sm text-muted-foreground">{results.length ? `${results.length} kandidat. Buka sumber sebelum menambahkan.` : "Tidak ditemukan hasil dari sumber resmi. Coba nomor, tahun, atau judul yang lebih spesifik."}</p>}
    {!!results?.length && <ul className="space-y-2">{results.map(row => {
      const added = entries.some(entry => entry.trim().toLowerCase() === row.dasar.toLowerCase());
      return <li key={row.url} className="min-w-0 space-y-2 rounded-lg border bg-card p-3">
        <p className="text-sm font-medium wrap-anywhere">{row.dasar}</p>
        <div className="flex flex-wrap items-center gap-3">
          <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4"><ExternalLink className="size-3" aria-hidden/>{new URL(row.url).hostname}</a>
          <Button type="button" size="sm" variant="outline" disabled={added || full} onClick={() => add(row.dasar)}><Plus aria-hidden/>{added ? "Sudah ditambahkan" : "Tambahkan ke Dasar"}</Button>
        </div>
      </li>;
    })}</ul>}
    {full && !!results?.length && <p className="text-xs text-muted-foreground">Dasar sudah mencapai batas 8 butir.</p>}
  </section>;
}
