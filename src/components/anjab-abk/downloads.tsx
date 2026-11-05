"use client";

import { useState } from "react";
import { Download, Files, LoaderCircle } from "lucide-react";
import type { AnjabPlan, SourceCatalog } from "@/lib/anjab-abk-calculation";
import type { AnjabPdfSelection } from "@/lib/anjab-abk-pdf-options";
import { inputClass } from "./shared";

export function AnjabDownloads({ year, plan, catalog, disabled }: { year: number; plan: AnjabPlan; catalog: SourceCatalog; disabled: boolean }) {
  const [document, setDocument] = useState("rekap"), [levelId, setLevelId] = useState("all");
  const [pending, setPending] = useState<"selected" | "all" | null>(null), [error, setError] = useState(""), [message, setMessage] = useState("");
  const family = catalog.families.find(f => f.id === document);
  async function download(all = false) {
    if (disabled || pending) return;
    const selection: AnjabPdfSelection = all ? { kind: "all" } : family ? { kind: "detail", familyId: family.id, ...(levelId !== "all" ? { levelId } : {}) } : { kind: "recap", sheet: document === "rekap" ? "all" : document as "perhitungan" | "usulan" | "penempatan" };
    setPending(all ? "all" : "selected"); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/anjab-abk/${year}/pdf`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ selection, plan }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "PDF gagal dibuat.");
      const bytes = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })), link = window.document.createElement("a");
      link.href = url; link.download = data.filename;
      window.document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage(all ? "PDF gabungan seluruh rekap dan rincian berhasil dibuat." : "Dokumen PDF berhasil dibuat.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "PDF gagal dibuat. Silakan coba lagi."); }
    finally { setPending(null); }
  }
  return <section aria-label="Download dokumen Anjab-ABK" className="space-y-3 rounded-xl border bg-white p-4">
    <div><h2 className="font-semibold">Download dokumen PDF</h2><p className="mt-1 text-xs text-zinc-500">Menggunakan seluruh nilai yang sedang tampil, termasuk perubahan yang belum disimpan. Format mengikuti sheet Excel lampiran.</p></div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="w-full min-w-0 text-sm sm:w-auto sm:min-w-56 sm:flex-1">Dokumen<select aria-label="Dokumen PDF" value={document} disabled={!!pending} onChange={e => { setDocument(e.target.value); setLevelId("all"); }} className={`${inputClass} mt-1`}>
        <optgroup label="Rekap"><option value="rekap">Semua rekap (3 dokumen)</option><option value="perhitungan">Perhitungan variabel dinas</option><option value="usulan">Usulan kebutuhan dan bezetting</option><option value="penempatan">Rekomendasi penempatan</option></optgroup>
        <optgroup label="Rincian perhitungan">{catalog.families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</optgroup>
      </select></label>
      {family && <label className="w-full text-sm sm:w-auto">Jenjang<select aria-label="Jenjang PDF" value={levelId} disabled={!!pending} onChange={e => setLevelId(e.target.value)} className={`${inputClass} mt-1`}><option value="all">Semua jenjang</option>{family.levels.map(l => <option key={l.id} value={l.id}>{l.grade}</option>)}</select></label>}
      <button type="button" disabled={disabled || !!pending} onClick={() => download()} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{pending === "selected" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}{pending === "selected" ? "Membuat PDF…" : "Download PDF pilihan"}</button>
      <button type="button" disabled={disabled || !!pending} onClick={() => download(true)} className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">{pending === "all" ? <LoaderCircle className="size-4 animate-spin" /> : <Files className="size-4" />}{pending === "all" ? "Menggabungkan PDF…" : "Download gabungan semua PDF"}</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
  </section>;
}
