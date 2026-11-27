import type { Metadata } from "next";
import { PdfToolsDocumentsTable } from "@/components/tools/pdf-tools-documents-table";
import { requireMenuAccess } from "@/lib/authorization";
import { listPdfToolDocuments, PDF_TOOLS_DOCUMENT_CAP, type PdfToolDocument } from "@/lib/pdf-tools-documents";

export const metadata: Metadata = { title: "Daftar Dokumen" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PdfToolsDocumentsPage() {
  const user = await requireMenuAccess("pdf-tools-documents");
  let documents: PdfToolDocument[] | null = null;
  try { documents = await listPdfToolDocuments(user.id); } catch { /* Show unavailable instead of an empty archive. */ }

  return (
    <div className="mx-auto min-w-0 max-w-[96rem] space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Tools</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Daftar Dokumen</h1>
        <p className="mt-2 text-sm text-muted-foreground">Hasil Compress, Merge, dan Split PDF milik Anda. Berkas sumber tidak disimpan.</p>
        {documents && <p className="mt-1 text-sm text-muted-foreground">{documents.length} dari {PDF_TOOLS_DOCUMENT_CAP} dokumen tersimpan.</p>}
      </header>
      {documents
        ? <PdfToolsDocumentsTable documents={documents} />
        : <p role="alert" className="rounded-xl border p-4 text-sm text-destructive">Arsip PDF tidak tersedia. Coba muat ulang atau hubungi administrator.</p>}
    </div>
  );
}
