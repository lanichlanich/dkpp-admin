"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Files, HardDrive, LoaderCircle, Plus, ScanText, Search, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Employee } from "@/lib/db";
import {
  EMPLOYEE_DOCUMENT_TYPE_LABELS,
  SKP_ASSESSMENT_VALUES,
  SKP_PREDICATE_VALUES,
  employeeDocumentIsSkp,
  employeeDocumentNeedsServicePeriod,
  getAllowedEmployeeDocumentTypes,
  type EmployeeDocumentType,
} from "@/lib/employee-document-types";
import type { EmployeeDocument } from "@/lib/employee-documents";
import type { LocalDocumentExtractionResult } from "@/lib/local-document-ai-types";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" });
const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("id-ID")} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
}

type DocumentMetadata = {
  nomorSurat: string;
  tglSurat: string;
  tmtSurat: string;
  masaKerja: string;
  tahun: string;
  penilaianKinerja: string;
  penilaianPerilaku: string;
  predikatSkp: string;
};

const emptyMetadata: DocumentMetadata = {
  nomorSurat: "",
  tglSurat: "",
  tmtSurat: "",
  masaKerja: "",
  tahun: "",
  penilaianKinerja: "",
  penilaianPerilaku: "",
  predikatSkp: "",
};

export function EmployeeDocumentsSection({ employee, active }: { employee: Employee; active: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const allowedTypes = getAllowedEmployeeDocumentTypes(employee.asnType);
  const [documentType, setDocumentType] = useState<EmployeeDocumentType | "">(allowedTypes[0] ?? "");
  const [metadata, setMetadata] = useState<DocumentMetadata>(emptyMetadata);
  const [documents, setDocuments] = useState<EmployeeDocument[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<LocalDocumentExtractionResult | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<EmployeeDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<EmployeeDocumentType | "all">("all");
  const [reloadKey, setReloadKey] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const busy = submitting || extracting;
  const isSkp = employeeDocumentIsSkp(documentType);
  const totalFileSize = useMemo(() => documents?.reduce((total, document) => total + document.fileSize, 0) ?? 0, [documents]);
  const availableDocumentTypes = useMemo(
    () => Array.from(new Set(documents?.map((document) => document.documentType) ?? [])),
    [documents],
  );
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    const query = searchQuery.trim().toLocaleLowerCase("id-ID");
    return documents.filter((document) => {
      if (typeFilter !== "all" && document.documentType !== typeFilter) return false;
      if (!query) return true;
      const searchText = [
        EMPLOYEE_DOCUMENT_TYPE_LABELS[document.documentType],
        document.nomorSurat,
        document.fileName,
        document.tahun?.toString(),
        document.penilaianKinerja,
        document.penilaianPerilaku,
        document.predikatSkp,
      ].filter(Boolean).join(" ").toLocaleLowerCase("id-ID");
      return searchText.includes(query);
    });
  }, [documents, searchQuery, typeFilter]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    fetch(`/api/employees/${encodeURIComponent(employee.nip)}/documents`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? "Dokumen gagal dimuat.");
        setLoadError("");
        setDocuments(payload.documents ?? []);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "Dokumen gagal dimuat.");
      });
    return () => controller.abort();
  }, [active, employee.nip, reloadKey]);

  async function readAndFill() {
    const fileInput = formRef.current?.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setErrors((current) => ({ ...current, file: ["Pilih file terlebih dahulu untuk dibaca."] }));
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setErrors((current) => ({ ...current, file: [`Ukuran file maksimal ${MAX_UPLOAD_SIZE_MB} MB.`] }));
      return;
    }

    setExtracting(true);
    setExtractionResult(null);
    setErrors((current) => ({ ...current, file: [] }));
    try {
      const request = new FormData();
      request.append("kind", "employee-document");
      request.append("employeeName", employee.name);
      request.append("employeeNip", employee.nip);
      request.append("documentType", documentType ? EMPLOYEE_DOCUMENT_TYPE_LABELS[documentType] : "");
      request.append("file", file);
      const response = await fetch("/api/document-ai/extract", { method: "POST", body: request });
      const payload = await response.json().catch(() => ({ message: "Dokumen gagal dibaca." })) as LocalDocumentExtractionResult & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Dokumen gagal dibaca.");

      const values = payload.values;
      const found = (["nomorSurat", "tglSurat", "tmtSurat", "masaKerja"] as const)
        .filter((field) => typeof values[field] === "string" && values[field].trim());
      setMetadata((current) => ({
        ...current,
        nomorSurat: current.nomorSurat || values.nomorSurat || "",
        tglSurat: current.tglSurat || values.tglSurat || "",
        tmtSurat: current.tmtSurat || values.tmtSurat || "",
        masaKerja: current.masaKerja || values.masaKerja || "",
      }));
      setExtractionResult(payload);
      toast.success(`${found.length} kolom ditemukan. Periksa kembali sebelum mengunggah.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokumen gagal dibaca.");
    } finally {
      setExtracting(false);
    }
  }

  function changeDocumentType(nextType: EmployeeDocumentType) {
    setDocumentType(nextType);
    setMetadata(emptyMetadata);
    setExtractionResult(null);
    setErrors({});
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (file && file.size > MAX_UPLOAD_SIZE_BYTES) {
      setErrors({ file: [`Ukuran file maksimal ${MAX_UPLOAD_SIZE_MB} MB.`] });
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const response = await fetch(`/api/employees/${encodeURIComponent(employee.nip)}/documents`, {
        method: "POST",
        body: new FormData(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        setErrors(payload.errors ?? {});
        throw new Error(payload.message ?? "Dokumen gagal diunggah.");
      }
      if (payload.document) setDocuments((current) => [payload.document, ...(current ?? [])]);
      form.reset();
      setDocumentType(allowedTypes[0] ?? "");
      setMetadata(emptyMetadata);
      setExtractionResult(null);
      setShowUploadForm(false);
      toast.success("Dokumen pegawai berhasil diunggah.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokumen gagal diunggah.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteDocument() {
    if (!documentToDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(
        `/api/employees/${encodeURIComponent(employee.nip)}/documents/${encodeURIComponent(documentToDelete.id)}`,
        { method: "DELETE" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Dokumen gagal dihapus.");
      setDocuments((current) => current?.filter((document) => document.id !== documentToDelete.id) ?? []);
      setDocumentToDelete(null);
      toast.success("Dokumen berhasil dihapus.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokumen gagal dihapus.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm shadow-zinc-100" aria-labelledby={`arsip-dokumen-${employee.nip}`}>
        <div className="flex flex-col gap-4 border-b bg-gradient-to-br from-white to-indigo-50/70 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="flex min-w-0 gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white"><Files className="size-5" /></span>
            <div>
              <h4 id={`arsip-dokumen-${employee.nip}`} className="font-semibold text-zinc-950">Arsip dokumen</h4>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Semua dokumen tersimpan aman dan dapat diunduh kembali.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {documents && documents.length > 0 && (
              <a href={`/api/employees/${encodeURIComponent(employee.nip)}/documents/archive`} className={cn(buttonVariants({ variant: "outline" }), "bg-white")} aria-label={`Download semua dokumen ${employee.name}`}>
                <Download />Download semua
              </a>
            )}
            <Button type="button" onClick={() => setShowUploadForm((current) => !current)} aria-expanded={showUploadForm} aria-controls={`form-dokumen-${employee.nip}`}>
              {showUploadForm ? <><X />Tutup form</> : <><Plus />Tambah dokumen</>}
            </Button>
          </div>
        </div>
        <div className="grid gap-px bg-zinc-200 md:grid-cols-3">
          <div className="flex items-center gap-3 bg-white px-4 py-3"><Files className="size-4 text-indigo-500" /><div><p className="text-xs text-zinc-500">Jumlah</p><p className="text-sm font-semibold text-zinc-900">{documents ? `${documents.length} dokumen` : "Memuat..."}</p></div></div>
          <div className="flex items-center gap-3 bg-white px-4 py-3"><HardDrive className="size-4 text-indigo-500" /><div><p className="text-xs text-zinc-500">Total ukuran</p><p className="text-sm font-semibold text-zinc-900">{documents ? formatFileSize(totalFileSize) : "Memuat..."}</p></div></div>
          <div className="flex items-center gap-3 bg-white px-4 py-3"><FileText className="size-4 text-indigo-500" /><div><p className="text-xs text-zinc-500">Terbaru</p><p className="text-sm font-semibold text-zinc-900">{documents?.[0] ? dateTimeFormatter.format(new Date(documents[0].createdAt)) : "-"}</p></div></div>
        </div>
      </section>

      {showUploadForm && (allowedTypes.length === 0 ? (
        <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">Jenis ASN ini belum memiliki kategori dokumen otomatis.</p>
      ) : (
        <form id={`form-dokumen-${employee.nip}`} ref={formRef} onSubmit={submit} className="space-y-5 rounded-2xl border bg-white p-4 shadow-sm shadow-zinc-100 sm:p-5">
          <div>
            <p className="font-semibold text-zinc-950">Tambah dokumen baru</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{isSkp ? "Isi hasil penilaian SKP dan pilih file dokumennya." : "Pilih jenis dokumen, lengkapi metadata, lalu unggah file."} PDF, DOC, atau DOCX · maksimal {MAX_UPLOAD_SIZE_MB} MB.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`documentType-${employee.nip}`}>Jenis dokumen</Label>
              <select id={`documentType-${employee.nip}`} name="documentType" value={documentType} onChange={(event) => changeDocumentType(event.target.value as EmployeeDocumentType)} disabled={busy} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40">
                {allowedTypes.map((type) => <option key={type} value={type}>{EMPLOYEE_DOCUMENT_TYPE_LABELS[type]}</option>)}
              </select>
            </div>
            {isSkp ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`tahun-${employee.nip}`}>Tahun</Label>
                  <Input id={`tahun-${employee.nip}`} name="tahun" type="number" min="1900" max="2100" step="1" value={metadata.tahun} onChange={(event) => setMetadata((current) => ({ ...current, tahun: event.target.value }))} disabled={busy} required aria-invalid={Boolean(errors.tahun?.length)} />
                  {errors.tahun?.[0] && <p className="text-xs font-medium text-destructive">{errors.tahun[0]}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`penilaianKinerja-${employee.nip}`}>Penilaian kinerja</Label>
                  <select id={`penilaianKinerja-${employee.nip}`} name="penilaianKinerja" value={metadata.penilaianKinerja} onChange={(event) => setMetadata((current) => ({ ...current, penilaianKinerja: event.target.value }))} disabled={busy} required aria-invalid={Boolean(errors.penilaianKinerja?.length)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40">
                    <option value="">Pilih penilaian kinerja</option>
                    {SKP_ASSESSMENT_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  {errors.penilaianKinerja?.[0] && <p className="text-xs font-medium text-destructive">{errors.penilaianKinerja[0]}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`penilaianPerilaku-${employee.nip}`}>Penilaian perilaku</Label>
                  <select id={`penilaianPerilaku-${employee.nip}`} name="penilaianPerilaku" value={metadata.penilaianPerilaku} onChange={(event) => setMetadata((current) => ({ ...current, penilaianPerilaku: event.target.value }))} disabled={busy} required aria-invalid={Boolean(errors.penilaianPerilaku?.length)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40">
                    <option value="">Pilih penilaian perilaku</option>
                    {SKP_ASSESSMENT_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  {errors.penilaianPerilaku?.[0] && <p className="text-xs font-medium text-destructive">{errors.penilaianPerilaku[0]}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`predikatSkp-${employee.nip}`}>Predikat SKP</Label>
                  <select id={`predikatSkp-${employee.nip}`} name="predikatSkp" value={metadata.predikatSkp} onChange={(event) => setMetadata((current) => ({ ...current, predikatSkp: event.target.value }))} disabled={busy} required aria-invalid={Boolean(errors.predikatSkp?.length)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40">
                    <option value="">Pilih predikat SKP</option>
                    {SKP_PREDICATE_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  {errors.predikatSkp?.[0] && <p className="text-xs font-medium text-destructive">{errors.predikatSkp[0]}</p>}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`nomorSurat-${employee.nip}`}>{documentType === "dokumen_lainnya" ? "Nama atau nomor dokumen" : "Nomor surat"}</Label>
                  <Input id={`nomorSurat-${employee.nip}`} name="nomorSurat" value={metadata.nomorSurat} onChange={(event) => setMetadata((current) => ({ ...current, nomorSurat: event.target.value }))} disabled={busy} required aria-invalid={Boolean(errors.nomorSurat?.length)} className={cn(extractionResult?.confidence.nomorSurat === "low" && metadata.nomorSurat && "border-amber-400 bg-amber-50")} />
                  {errors.nomorSurat?.[0] && <p className="text-xs font-medium text-destructive">{errors.nomorSurat[0]}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`tglSurat-${employee.nip}`}>{documentType === "dokumen_lainnya" ? "Tanggal dokumen" : "Tanggal surat"}</Label>
                  <Input id={`tglSurat-${employee.nip}`} name="tglSurat" type="date" value={metadata.tglSurat} onChange={(event) => setMetadata((current) => ({ ...current, tglSurat: event.target.value }))} disabled={busy} required aria-invalid={Boolean(errors.tglSurat?.length)} className={cn(extractionResult?.confidence.tglSurat === "low" && metadata.tglSurat && "border-amber-400 bg-amber-50")} />
                  {errors.tglSurat?.[0] && <p className="text-xs font-medium text-destructive">{errors.tglSurat[0]}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`tmtSurat-${employee.nip}`}>{documentType === "dokumen_lainnya" ? "Tanggal berlaku dokumen" : "TMT surat"}</Label>
                  <Input id={`tmtSurat-${employee.nip}`} name="tmtSurat" type="date" value={metadata.tmtSurat} onChange={(event) => setMetadata((current) => ({ ...current, tmtSurat: event.target.value }))} disabled={busy} required aria-invalid={Boolean(errors.tmtSurat?.length)} className={cn(extractionResult?.confidence.tmtSurat === "low" && metadata.tmtSurat && "border-amber-400 bg-amber-50")} />
                  {errors.tmtSurat?.[0] && <p className="text-xs font-medium text-destructive">{errors.tmtSurat[0]}</p>}
                </div>
              </>
            )}
            {!isSkp && documentType && employeeDocumentNeedsServicePeriod(documentType) && (
              <div className="space-y-2">
                <Label htmlFor={`masaKerja-${employee.nip}`}>Masa kerja</Label>
                <Input id={`masaKerja-${employee.nip}`} name="masaKerja" placeholder="Contoh: 1 Tahun 2 Bulan" value={metadata.masaKerja} onChange={(event) => setMetadata((current) => ({ ...current, masaKerja: event.target.value }))} disabled={busy} required aria-invalid={Boolean(errors.masaKerja?.length)} className={cn(extractionResult?.confidence.masaKerja === "low" && metadata.masaKerja && "border-amber-400 bg-amber-50")} />
                {errors.masaKerja?.[0] && <p className="text-xs font-medium text-destructive">{errors.masaKerja[0]}</p>}
              </div>
            )}
            <div className={cn("space-y-2", isSkp || !documentType || !employeeDocumentNeedsServicePeriod(documentType) ? "sm:col-span-2" : undefined)}>
              <Label htmlFor={`file-${employee.nip}`}>File dokumen</Label>
              <p className="text-xs text-muted-foreground">Tombol Baca &amp; isi otomatis mengirim dokumen ke Google Gemini. Periksa hasil sebelum mengunggah.</p>
              <Input id={`file-${employee.nip}`} name="file" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} required aria-invalid={Boolean(errors.file?.length)} className="cursor-pointer file:mr-3 file:font-medium" />
              {errors.file?.[0] && <p className="text-xs font-medium text-destructive">{errors.file[0]}</p>}
            </div>
          </div>
          {extractionResult && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
              <p className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4" />Diproses menggunakan Gemini: {extractionResult.model}</p>
              <p className="mt-1">Data hanya mengisi draf. Kolom kuning memiliki keyakinan rendah dan perlu diperiksa.</p>
              {extractionResult.warnings.length > 0 && <ul className="mt-2 list-disc pl-5">{extractionResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {!isSkp && (
              <Button type="button" variant="outline" onClick={readAndFill} disabled={busy}>
                {extracting ? <><LoaderCircle className="animate-spin" />Membaca dokumen...</> : <><ScanText />Baca & isi otomatis</>}
              </Button>
            )}
            <Button type="submit" disabled={busy}>{submitting ? <><LoaderCircle className="animate-spin" />Mengunggah...</> : <><Upload />Unggah dokumen</>}</Button>
          </div>
        </form>
      ))}

      <div className="space-y-3">
        {documents && documents.length > 0 && (
          <div className="rounded-xl border bg-white p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari nama, nomor, tahun, atau predikat..." aria-label="Cari dokumen pegawai" className="pl-9" />
              </div>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as EmployeeDocumentType | "all")} aria-label="Filter jenis dokumen" className="h-8 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40">
                <option value="all">Semua jenis</option>
                {availableDocumentTypes.map((type) => <option key={type} value={type}>{EMPLOYEE_DOCUMENT_TYPE_LABELS[type]}</option>)}
              </select>
              <Badge variant="secondary" aria-live="polite">{filteredDocuments.length} hasil</Badge>
            </div>
          </div>
        )}
        {documents === null && !loadError ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed bg-white p-8 text-sm text-zinc-500"><LoaderCircle className="size-4 animate-spin" />Memuat dokumen...</div>
        ) : loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>{loadError}</p><Button type="button" variant="outline" size="sm" className="mt-3 bg-white" onClick={() => { setDocuments(null); setLoadError(""); setReloadKey((current) => current + 1); }}>Coba lagi</Button></div>
        ) : documents?.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white px-5 py-10 text-center"><span className="mx-auto grid size-11 place-items-center rounded-full bg-zinc-100 text-zinc-500"><Files className="size-5" /></span><p className="mt-3 font-medium text-zinc-900">Belum ada dokumen</p><p className="mt-1 text-sm text-zinc-500">Tambahkan dokumen pertama untuk pegawai ini.</p><Button type="button" size="sm" className="mt-4" onClick={() => setShowUploadForm(true)}><Plus />Tambah dokumen</Button></div>
        ) : filteredDocuments.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white p-6 text-center"><p className="text-sm font-medium text-zinc-900">Dokumen tidak ditemukan</p><p className="mt-1 text-xs text-zinc-500">Coba kata kunci atau jenis dokumen lain.</p><Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => { setSearchQuery(""); setTypeFilter("all"); }}>Reset pencarian</Button></div>
        ) : filteredDocuments.map((document) => (
          <article key={document.id} className="rounded-2xl border bg-white p-4 transition-shadow hover:shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><FileText className="size-5" /></span>
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{EMPLOYEE_DOCUMENT_TYPE_LABELS[document.documentType]}</Badge>{document.documentType === "sasaran_kinerja_pegawai" && <Badge variant="secondary">{document.predikatSkp}</Badge>}</div>
                <p className="mt-2 font-semibold text-zinc-950">{document.documentType === "sasaran_kinerja_pegawai" ? `SKP Tahun ${document.tahun}` : document.nomorSurat}</p>
                {document.documentType === "sasaran_kinerja_pegawai" ? (
                  <dl className="mt-2 grid gap-x-5 gap-y-1 text-xs text-zinc-500 sm:grid-cols-2"><div><dt className="inline">Kinerja: </dt><dd className="inline font-medium text-zinc-700">{document.penilaianKinerja}</dd></div><div><dt className="inline">Perilaku: </dt><dd className="inline font-medium text-zinc-700">{document.penilaianPerilaku}</dd></div></dl>
                ) : (
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Tanggal {formatDate(document.tglSurat)} · TMT {formatDate(document.tmtSurat)}{document.masaKerja ? ` · Masa kerja ${document.masaKerja}` : ""}</p>
                )}
                <p className="mt-3 truncate text-sm font-medium text-zinc-700" title={document.fileName}>{document.fileName} <span className="font-normal text-zinc-400">· {formatFileSize(document.fileSize)}</span></p>
                <p className="mt-1 text-xs text-zinc-400">Diunggah {dateTimeFormatter.format(new Date(document.createdAt))} oleh {document.createdBy}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 border-t pt-3 sm:border-0 sm:pt-0">
                <a href={`/api/employees/${encodeURIComponent(employee.nip)}/documents/${encodeURIComponent(document.id)}/download`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1 sm:flex-none")}>
                  <Download />Unduh
                </a>
                <Button type="button" variant="destructive" size="sm" className="flex-1 sm:flex-none" onClick={() => setDocumentToDelete(document)} aria-label={`Hapus ${document.fileName}`}>
                  <Trash2 />Hapus
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <AlertDialog open={Boolean(documentToDelete)} onOpenChange={(open) => { if (!open && !deleting) setDocumentToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dokumen ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {documentToDelete ? `${EMPLOYEE_DOCUMENT_TYPE_LABELS[documentToDelete.documentType]} (${documentToDelete.fileName}) akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.` : "Dokumen akan dihapus permanen."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={deleteDocument}>
              {deleting ? <><LoaderCircle className="animate-spin" />Menghapus...</> : <><Trash2 />Ya, hapus</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
