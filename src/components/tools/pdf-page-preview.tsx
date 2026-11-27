import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, LoaderCircle } from "lucide-react";
import type { PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PDF_TOOLS_MAX_PAGES } from "@/lib/pdf-tools-config";

export type PdfPageThumbnail = { fileIndex: number; pageNumber: number; url: string };
type PreviewResult = { files: readonly File[] } & (
  | { status: "ready"; pages: PdfPageThumbnail[]; pageCounts: number[] }
  | { status: "error"; message: string }
);

class PreviewError extends Error {}

// Only the app's packaged decoders may be fetched, never a URL from the PDF.
class PreviewBinaryDataFactory {
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    if (kind !== "wasmUrl" || (filename !== "jbig2.wasm" && filename !== "openjpeg.wasm")) {
      throw new Error("Unsupported PDF preview resource");
    }
    const response = await fetch(`/api/tools/pdf-assets/${filename}`);
    if (!response.ok) throw new Error("PDF preview decoder unavailable");
    return new Uint8Array(await response.arrayBuffer());
  }
}

export function usePdfPagePreview(files: readonly File[], enabled: boolean) {
  const [result, setResult] = useState<PreviewResult>();

  useEffect(() => {
    if (!enabled || !files.length) return;
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    let renderTask: RenderTask | undefined;
    const urls: string[] = [];

    async function destroyDocument() {
      const task = loadingTask;
      loadingTask = undefined;
      await task?.destroy().catch(() => {});
    }

    function stop() {
      cancelled = true;
      renderTask?.cancel();
      void destroyDocument();
      for (const url of urls.splice(0)) URL.revokeObjectURL(url);
    }

    const timeout = window.setTimeout(() => {
      stop();
      setResult({ files, status: "error", message: "Pratinjau terlalu lama. Coba PDF yang lebih kecil." });
    }, 75_000);

    async function load() {
      const canvas = document.createElement("canvas");
      let fileName = "";
      let pageNumber = 0;
      try {
        // Serve the installed ESM module and worker unchanged: bundling the large worker
        // into Webpack exhausts memory on the VPS and can separate their versions.
        const moduleUrl = "/api/tools/pdf-assets/pdf.min.mjs";
        const { AnnotationMode, GlobalWorkerOptions, getDocument } = await import(/* webpackIgnore: true */ moduleUrl) as typeof import("pdfjs-dist");
        if (cancelled) return;
        GlobalWorkerOptions.workerSrc = "/api/tools/pdf-assets/pdf.worker.min.mjs";
        const pages: PdfPageThumbnail[] = [];
        const pageCounts: number[] = [];
        for (const [fileIndex, file] of files.entries()) {
          fileName = file.name;
          pageNumber = 0;
          const data = await file.arrayBuffer();
          if (cancelled) return;
          loadingTask = getDocument({
            data,
            enableXfa: false,
            stopAtErrors: true,
            maxImageSize: 32_000_000,
            canvasMaxAreaInBytes: 32_000_000,
            useSystemFonts: true,
            useWorkerFetch: false,
            BinaryDataFactory: PreviewBinaryDataFactory,
          });
          const pdf = await loadingTask.promise;
          if (cancelled) return;
          if (pdf.numPages < 1 || pdf.isPureXfa) throw new PreviewError(`Halaman dalam “${fileName}” tidak dapat ditampilkan.`);
          if (pages.length + pdf.numPages > PDF_TOOLS_MAX_PAGES) {
            throw new PreviewError(`Total maksimal ${PDF_TOOLS_MAX_PAGES} halaman per proses.`);
          }
          pageCounts.push(pdf.numPages);
          for (pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            if (cancelled) return;
            const original = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: Math.min(180 / original.width, 224 / original.height) });
            canvas.width = Math.max(1, Math.ceil(viewport.width));
            canvas.height = Math.max(1, Math.ceil(viewport.height));
            // Render pixels only: no annotation, link, form, or script layer.
            renderTask = page.render({ canvas, viewport, annotationMode: AnnotationMode.DISABLE });
            await renderTask.promise;
            renderTask = undefined;
            if (cancelled) return;
            page.cleanup();
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.82));
            if (cancelled) return;
            if (!blob) throw new Error("Thumbnail unavailable");
            const url = URL.createObjectURL(blob);
            urls.push(url);
            pages.push({ fileIndex, pageNumber, url });
          }
          await destroyDocument();
          if (cancelled) return;
        }
        setResult({ files, status: "ready", pages, pageCounts });
      } catch (error) {
        if (!cancelled) {
          const at = fileName ? ` untuk “${fileName}”${pageNumber ? `, halaman ${pageNumber}` : ""}` : "";
          const message = error instanceof PreviewError ? error.message
            : error instanceof Error && error.name === "PasswordException" ? `PDF “${fileName}” dilindungi sandi.`
            : `Pratinjau tidak dapat dibuat${at}. Coba pilih ulang atau gunakan PDF lain.`;
          stop();
          setResult({ files, status: "error", message });
        }
      } finally {
        window.clearTimeout(timeout);
        canvas.width = canvas.height = 0;
      }
    }

    void load();
    return () => {
      window.clearTimeout(timeout);
      stop();
    };
  }, [enabled, files]);

  // A changed selection immediately invalidates results, before the next effect runs.
  return enabled && result?.files === files ? result : undefined;
}

export function PdfPreviewLoading() {
  return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Menyiapkan pratinjau halaman…
  </p>;
}

type PreviewGridProps = { pages: readonly PdfPageThumbnail[]; files: readonly File[]; busy: boolean } & (
  | { mode: "merge"; onMove: (from: number, to: number) => void }
  | { mode: "split"; selected: ReadonlySet<number>; onToggle: (pageNumber: number, checked: boolean) => void }
  | { mode: "view" }
);

export function PdfPagePreviewGrid(props: PreviewGridProps) {
  const { pages, files, busy, mode } = props;
  return <ol aria-label={mode === "merge" ? "Urutan halaman hasil" : mode === "split" ? "Pilihan halaman" : "Pratinjau halaman"} className="grid max-h-[32rem] grid-cols-2 items-start gap-2 overflow-y-auto p-1 sm:grid-cols-3 lg:grid-cols-4" role="list">
    {pages.map(({ fileIndex, pageNumber, url }, index) => {
      const name = files[fileIndex].name;
      const selected = mode === "split" && props.selected.has(pageNumber);
      const checkboxId = `pdf-page-${fileIndex}-${pageNumber}`;
      return <li key={`${fileIndex}:${pageNumber}`} className={`min-w-0 space-y-2 rounded-lg border p-2 ${selected ? "border-primary bg-accent" : "bg-card"}`}>
        <div className="flex h-32 items-center justify-center overflow-hidden rounded bg-muted sm:h-40">
          {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails are local Blob URLs */}
          <img src={url} alt="" decoding="async" loading="lazy" className="max-h-full max-w-full object-contain shadow-sm" />
        </div>
        {mode === "merge" ? <>
          <p className="text-sm font-medium">{index + 1}. Halaman {pageNumber}</p>
          <p className="truncate text-xs text-muted-foreground" title={`${fileIndex + 1}. ${name}`}>{fileIndex + 1}. {name}</p>
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="icon-sm" disabled={busy || index === 0} aria-label={`Naikkan halaman ${pageNumber} dari berkas ${fileIndex + 1}`} title="Pindahkan sebelumnya" onClick={() => props.onMove(index, index - 1)}><ArrowUp /></Button>
            <Button type="button" variant="outline" size="icon-sm" disabled={busy || index === pages.length - 1} aria-label={`Turunkan halaman ${pageNumber} dari berkas ${fileIndex + 1}`} title="Pindahkan sesudahnya" onClick={() => props.onMove(index, index + 1)}><ArrowDown /></Button>
          </div>
        </> : mode === "split" ? <div className="flex items-center gap-2">
          <Checkbox id={checkboxId} checked={selected} disabled={busy} onCheckedChange={checked => props.onToggle(pageNumber, checked)} aria-labelledby={`${checkboxId}-label`} />
          <label id={`${checkboxId}-label`} htmlFor={checkboxId} className="min-w-0 flex-1 cursor-pointer py-1 text-sm font-medium">Halaman {pageNumber}</label>
        </div> : <p className="text-sm font-medium">Halaman {pageNumber}</p>}
      </li>;
    })}
  </ol>;
}
