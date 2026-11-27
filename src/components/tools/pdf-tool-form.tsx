"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Download, FileText, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PDF_TOOLS_MAX_BYTES, PDF_TOOLS_MAX_FILES, type PdfTool } from "@/lib/pdf-tools-config";

type Result = { name: string; pages: number; originalSize?: number; file: File };
const size = (bytes: number) => bytes < 1024 ** 2 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 ** 2).toLocaleString("id-ID", { maximumFractionDigits: 2 })} MB`;
const basename = (name: string) => name.replace(/\.pdf$/i, "");

export function PdfToolForm({ tool }: { tool: PdfTool }) {
  const merge = tool.operation === "merge";
  const split = tool.operation === "split";
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [ranges, setRanges] = useState("");
  const [profile, setProfile] = useState("balanced");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const bytes = files.reduce((sum, file) => sum + file.size, 0);

  function add(selected: File[]) {
    setError("");
    if (selected.some(file => !/\.pdf$/i.test(file.name))) { setError("Pilih berkas dengan ekstensi .pdf."); return; }
    const next = merge ? [...files, ...selected] : selected;
    if (next.length > PDF_TOOLS_MAX_FILES || next.reduce((sum, file) => sum + file.size, 0) > PDF_TOOLS_MAX_BYTES) {
      setError("Maksimal 8 berkas dan total 20 MB."); return;
    }
    setFiles(next); setResults([]);
  }
  function move(index: number, offset: number) {
    const next = [...files];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setFiles(next); setResults([]);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(""); setResults([]);
    const body = new FormData();
    files.forEach(file => body.append("files", file));
    if (split) body.set("ranges", ranges);
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
          <p id="pdf-limits" className="text-xs text-muted-foreground">Total maksimal 20 MB dan 150 halaman{merge && "; 2–8 berkas"}. PDF dengan sandi atau TTE tidak didukung.</p>
        </div>
        {files.length > 0 && <ol aria-label="Urutan dokumen" className="space-y-2">{files.map((file, i) => <li key={`${i}-${file.name}`} className="flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5">
          <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="break-all text-sm">{i + 1}. {file.name}</p><p className="text-xs text-muted-foreground">{size(file.size)}</p></div>
          {merge && <><Button type="button" aria-label={`Naikkan berkas ${i + 1}`} title="Naikkan urutan" variant="ghost" size="icon-sm" disabled={i === 0 || busy} onClick={() => move(i, -1)}><ArrowUp /></Button><Button type="button" aria-label={`Turunkan berkas ${i + 1}`} title="Turunkan urutan" variant="ghost" size="icon-sm" disabled={i === files.length - 1 || busy} onClick={() => move(i, 1)}><ArrowDown /></Button></>}
          <Button type="button" aria-label={`Hapus berkas ${i + 1}`} title="Keluarkan berkas" variant="ghost" size="icon-sm" onClick={() => { setFiles(files.filter((_, index) => index !== i)); setResults([]); }}><X /></Button>
        </li>)}</ol>}
        {split && <div className="space-y-2"><label htmlFor="pdf-ranges" className="text-sm font-medium">Halaman yang dipisahkan</label><Input id="pdf-ranges" required maxLength={160} value={ranges} placeholder="1-3; 4-6; 8" aria-describedby="pdf-range-help" onChange={event => { setRanges(event.target.value); setResults([]); }} /><p id="pdf-range-help" className="text-xs text-muted-foreground">Pisahkan dengan titik koma. Contoh di atas menghasilkan tiga PDF. Maksimal 8 bagian.</p></div>}
        {tool.operation === "compress" && <div className="space-y-2"><label htmlFor="pdf-profile" className="text-sm font-medium">Tingkat kompresi</label><select id="pdf-profile" className="block min-h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-2" value={profile} onChange={event => { setProfile(event.target.value); setResults([]); }}><option value="balanced">Seimbang — pertahankan keterbacaan</option><option value="small">Lebih kecil — kualitas gambar lebih rendah</option></select></div>}
        <Button type="submit" disabled={busy || files.length < (merge ? 2 : 1) || bytes > PDF_TOOLS_MAX_BYTES}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? "Sedang memproses…" : tool.action}</Button>
      </fieldset>
      {busy && <p role="status" className="mt-3 text-sm text-muted-foreground">Membaca dokumen dan menyiapkan nama hasil…</p>}
      {error && <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    </form>
    {results.length > 0 && <section aria-labelledby="pdf-results" className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
      <h2 id="pdf-results" className="font-semibold">Hasil siap diunduh</h2><p className="text-sm text-muted-foreground">Periksa nama yang disarankan. Ubah jika judul atau nama orang belum tepat.</p>
      {results.map((result, i) => <div key={i} className="space-y-2 rounded-lg border p-3">
        <label htmlFor={`pdf-name-${i}`} className="text-sm font-medium">Nama hasil {results.length > 1 ? i + 1 : "PDF"}</label>
        <div className="flex items-center gap-2"><Input id={`pdf-name-${i}`} maxLength={130} value={result.name} onChange={event => setResults(results.map((item, index) => index === i ? {...item, name:event.target.value} : item))} /><span className="text-sm text-muted-foreground">.pdf</span></div>
        <p className="text-sm text-muted-foreground">{result.pages} halaman · {size(result.file.size)}{result.originalSize !== undefined && (result.file.size < result.originalSize ? ` (asal ${size(result.originalSize)})` : " · Sudah optimal, ukuran asli dipertahankan.")}</p>
        <Button type="button" variant="outline" onClick={() => download(result)}><Download aria-hidden="true" />Unduh PDF{results.length > 1 ? ` ${i + 1}` : ""}</Button>
      </div>)}
    </section>}
    <p className="text-xs leading-relaxed text-muted-foreground">Berkas diproses lokal di server DKPP, tidak dikirim ke layanan AI eksternal, dan tidak disimpan di arsip. Unduh hasil sebelum meninggalkan halaman.</p>
  </div>;
}
