"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Download, FileText, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PDF_DOCUMENTS_PATH, PDF_TOOLS_MAX_BYTES, PDF_TOOLS_MAX_FILES, PDF_TOOLS_MAX_PAGES, type PdfTool } from "@/lib/pdf-tools-config";
import { PdfPagePreviewGrid, PdfPreviewLoading, usePdfPagePreview, type PdfPageThumbnail } from "./pdf-page-preview";
import { encodeMergePageOrder, encodeSplitRanges, movePdfPage, PDF_SPLIT_MAX_OUTPUTS, type SplitPageMode } from "./pdf-page-selection";

type Result = { name: string; pages: number; originalSize?: number; file: File };
const size = (bytes: number) => bytes < 1024 ** 2 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 ** 2).toLocaleString("id-ID", { maximumFractionDigits: 2 })} MB`;
const basename = (name: string) => name.replace(/\.pdf$/i, "");

export function PdfToolForm({ tool, canViewDocuments = false }: { tool: PdfTool; canViewDocuments?: boolean }) {
  const merge = tool.operation === "merge";
  const split = tool.operation === "split";
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [customOrder, setCustomOrder] = useState<readonly PdfPageThumbnail[]>();
  const [selectedPages, setSelectedPages] = useState<ReadonlySet<number>>(() => new Set());
  const [splitMode, setSplitMode] = useState<SplitPageMode | "advanced">("combined");
  const [ranges, setRanges] = useState("");
  const [profile, setProfile] = useState("balanced");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const bytes = files.reduce((sum, file) => sum + file.size, 0);
  const preview = usePdfPagePreview(files, merge || split);
  const readyPreview = preview?.status === "ready" ? preview : undefined;
  const orderedPages = customOrder ?? readyPreview?.pages ?? [];
  const order = merge && readyPreview ? encodeMergePageOrder(orderedPages, readyPreview.pageCounts) : null;
  const splitRanges = split && readyPreview
    ? splitMode === "advanced" ? ranges.trim() : encodeSplitRanges(selectedPages, readyPreview.pageCounts[0], splitMode)
    : null;
  const canSubmit = files.length >= (merge ? 2 : 1) && bytes <= PDF_TOOLS_MAX_BYTES && (!merge || !!order) && (!split || !!splitRanges);

  function replaceFiles(next: File[]) {
    setFiles(next);
    // Source indices belong to this exact list of files, not to file names.
    setCustomOrder(undefined);
    setSelectedPages(new Set());
    setRanges("");
    setResults([]);
    setError("");
  }

  function add(selected: File[]) {
    if (!selected.length) return;
    setError("");
    if (selected.some(file => !/\.pdf$/i.test(file.name))) { setError("Pilih berkas dengan ekstensi .pdf."); return; }
    const next = merge ? [...files, ...selected] : selected;
    if (next.length > PDF_TOOLS_MAX_FILES || next.reduce((sum, file) => sum + file.size, 0) > PDF_TOOLS_MAX_BYTES) {
      setError("Maksimal 8 berkas dan total 20 MB."); return;
    }
    replaceFiles(next);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !canSubmit) return;
    submitting.current = true;
    setBusy(true); setError(""); setResults([]);
    const body = new FormData();
    files.forEach(file => body.append("files", file));
    if (order) body.set("order", order);
    if (splitRanges) body.set("ranges", splitRanges);
    if (tool.operation === "compress") body.set("profile", profile);
    try {
      const response = await fetch(`/api/tools/pdf/${tool.operation}`, { method: "POST", body, signal: AbortSignal.timeout(105_000) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Pemrosesan gagal. Silakan coba lagi.");
      const data = await response.formData();
      const entries: Omit<Result, "file">[] = JSON.parse(String(data.get("metadata")));
      const outputs = data.getAll("results");
      if (!entries.length || outputs.length !== entries.length || !outputs.every(file => file instanceof File)) throw new Error("Respons PDF tidak lengkap.");
      setResults(entries.map((entry, i) => ({ ...entry, name: basename(entry.name), file: outputs[i] })));
    } catch (error) {
      setError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Waktu pemrosesan habis. Coba dengan PDF lebih kecil.");
    } finally { submitting.current = false; setBusy(false); }
  }
  function download(result: Result) {
    const url = URL.createObjectURL(result.file);
    const link = document.createElement("a");
    link.href = url;
    const safe = basename(result.name).replace(/[<>:"/\\|?*\p{C}]/gu, " ").trim().replace(/^[. ]+|[. ]+$/g, "");
    link.download = `${safe || "Dokumen"}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
  }

  return <div className="space-y-5">
    <form onSubmit={submit} className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <div className="space-y-2"><label htmlFor="pdf-input" className="text-sm font-medium">{merge ? "Pilih beberapa PDF" : "Pilih PDF"}</label>
          <Input id="pdf-input" type="file" accept=".pdf,application/pdf" multiple={merge} aria-describedby="pdf-limits" onChange={event => { add(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }} />
          <p id="pdf-limits" className="text-xs text-muted-foreground">Total maksimal 20 MB dan {PDF_TOOLS_MAX_PAGES} halaman{merge && "; 2–8 berkas"}. PDF dengan sandi atau TTE tidak didukung.</p>
        </div>
        {files.length > 0 && <ol aria-label="Berkas yang dipilih" className="space-y-2">{files.map((file, i) => <li key={`${i}-${file.name}`} className="flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5">
          <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="break-all text-sm">{i + 1}. {file.name}</p><p className="text-xs text-muted-foreground">{size(file.size)}</p></div>
          <Button type="button" aria-label={`Hapus berkas ${i + 1}`} title="Keluarkan berkas" variant="ghost" size="icon-sm" onClick={() => replaceFiles(files.filter((_, index) => index !== i))}><X /></Button>
        </li>)}</ol>}
        {(merge || split) && files.length > 0 && !preview && <PdfPreviewLoading />}
        {preview?.status === "error" && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{preview.message}</p>}
        {merge && readyPreview && <section className="space-y-2" aria-labelledby="pdf-page-order">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="pdf-page-order" className="text-sm font-semibold">Urutan halaman hasil ({orderedPages.length})</h2>
            {customOrder && <Button type="button" variant="outline" size="sm" onClick={() => { setCustomOrder(undefined); setResults([]); }}>Kembalikan urutan awal</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Gunakan panah untuk memindahkan halaman, termasuk antarberkas. Menambah atau menghapus berkas mengembalikan urutan awal.</p>
          <PdfPagePreviewGrid mode="merge" pages={orderedPages} files={files} busy={busy} onMove={(from, to) => {
            setCustomOrder(current => movePdfPage(current ?? readyPreview.pages, from, to));
            setResults([]);
          }} />
        </section>}
        {split && readyPreview && <section className="space-y-3" aria-labelledby="pdf-split-pages">
          <h2 id="pdf-split-pages" className="text-sm font-semibold">Halaman yang dipisahkan</h2>
          <div className="space-y-2">
            <label htmlFor="pdf-split-mode" className="text-sm font-medium">Cara memisahkan</label>
            <select id="pdf-split-mode" className="block min-h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-2" value={splitMode} onChange={event => { setSplitMode(event.target.value as typeof splitMode); setResults([]); }}>
              <option value="combined">Gabungkan halaman terpilih ke satu PDF</option>
              <option value="individual">Satu PDF untuk setiap halaman terpilih</option>
              <option value="advanced">Tentukan bagian dengan rentang (lanjutan)</option>
            </select>
          </div>
          {splitMode === "advanced" ? <div className="space-y-2">
            <label htmlFor="pdf-ranges" className="text-sm font-medium">Rentang halaman</label>
            <Input id="pdf-ranges" required maxLength={1200} value={ranges} placeholder="1,3-4; 6-8" aria-describedby="pdf-range-help" onChange={event => { setRanges(event.target.value); setResults([]); }} />
            <p id="pdf-range-help" className="text-xs text-muted-foreground">Gunakan koma untuk memilih halaman dalam satu PDF dan titik koma untuk memulai PDF baru. Maksimal {PDF_SPLIT_MAX_OUTPUTS} PDF.</p>
            <PdfPagePreviewGrid mode="view" pages={readyPreview.pages} files={files} busy={busy} />
          </div> : <>
            <div className="flex flex-wrap items-center gap-2">
              <p role="status" className="mr-auto text-xs text-muted-foreground">{selectedPages.size} dari {readyPreview.pages.length} halaman dipilih</p>
              {splitMode === "combined" && <Button type="button" variant="outline" size="sm" disabled={selectedPages.size === readyPreview.pages.length} onClick={() => { setSelectedPages(new Set(readyPreview.pages.map(page => page.pageNumber))); setResults([]); }}>Pilih semua</Button>}
              <Button type="button" variant="outline" size="sm" disabled={!selectedPages.size} onClick={() => { setSelectedPages(new Set()); setResults([]); }}>Kosongkan pilihan</Button>
            </div>
            {splitMode === "individual" && <p className={`text-xs ${selectedPages.size > PDF_SPLIT_MAX_OUTPUTS ? "text-destructive" : "text-muted-foreground"}`} role={selectedPages.size > PDF_SPLIT_MAX_OUTPUTS ? "alert" : undefined}>Pilih maksimal {PDF_SPLIT_MAX_OUTPUTS} halaman untuk membuat PDF terpisah.</p>}
            <PdfPagePreviewGrid mode="split" pages={readyPreview.pages} files={files} busy={busy} selected={selectedPages} onToggle={(page, checked) => {
              setSelectedPages(current => {
                const next = new Set(current);
                if (checked) next.add(page); else next.delete(page);
                return next;
              });
              setResults([]);
            }} />
          </>}
        </section>}
        {tool.operation === "compress" && <div className="space-y-2"><label htmlFor="pdf-profile" className="text-sm font-medium">Tingkat kompresi</label><select id="pdf-profile" className="block min-h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-2" value={profile} aria-describedby={profile === "target1mb" ? "pdf-target-help" : undefined} onChange={event => { setProfile(event.target.value); setResults([]); }}><option value="balanced">Seimbang — pertahankan keterbacaan</option><option value="small">Lebih kecil — kualitas gambar lebih rendah</option><option value="target1mb">Di bawah 1 MB</option></select>{profile === "target1mb" && <p id="pdf-target-help" className="text-xs text-muted-foreground">Resolusi gambar dapat turun untuk mencapai target. Periksa keterbacaan hasil sebelum digunakan.</p>}</div>}
        <Button type="submit" disabled={busy || !canSubmit}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? "Sedang memproses…" : tool.action}</Button>
      </fieldset>
      {busy && <p role="status" className="mt-3 text-sm text-muted-foreground">Membaca dokumen dan menyiapkan nama hasil…</p>}
      {error && <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    </form>
    {results.length > 0 && <section aria-labelledby="pdf-results" className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
      <h2 id="pdf-results" className="font-semibold">Hasil siap diunduh</h2><p className="text-sm text-muted-foreground">Perubahan nama di bawah hanya berlaku untuk unduhan. {canViewDocuments && <>Untuk mengganti nama yang tersimpan, buka <Link href={PDF_DOCUMENTS_PATH} className="font-medium underline underline-offset-2">Daftar Dokumen</Link>.</>}</p>
      {results.map((result, i) => <div key={i} className="space-y-2 rounded-lg border p-3">
        <label htmlFor={`pdf-name-${i}`} className="text-sm font-medium">Nama hasil {results.length > 1 ? i + 1 : "PDF"}</label>
        <div className="flex items-center gap-2"><Input id={`pdf-name-${i}`} maxLength={130} value={result.name} onChange={event => setResults(results.map((item, index) => index === i ? {...item, name:event.target.value} : item))} /><span className="text-sm text-muted-foreground">.pdf</span></div>
        <p className="text-sm text-muted-foreground">{result.pages} halaman · {size(result.file.size)}{result.originalSize !== undefined && (result.file.size < result.originalSize ? ` (asal ${size(result.originalSize)})` : " · Sudah optimal, ukuran asli dipertahankan.")}</p>
        <Button type="button" variant="outline" onClick={() => download(result)}><Download aria-hidden="true" />Unduh PDF{results.length > 1 ? ` ${i + 1}` : ""}</Button>
      </div>)}
    </section>}
    <p className="text-xs leading-relaxed text-muted-foreground">{(merge || split) && "Pratinjau dibuat di peramban; berkas baru dikirim saat Anda menekan tombol proses. "}Pemrosesan berlangsung di server DKPP tanpa mengirim berkas ke layanan AI eksternal. Hanya PDF hasil yang disimpan, bukan berkas sumber. {canViewDocuments && <Link href={PDF_DOCUMENTS_PATH} className="font-medium underline underline-offset-2">Buka Daftar Dokumen</Link>}</p>
  </div>;
}
