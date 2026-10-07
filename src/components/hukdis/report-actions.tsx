"use client";

import { useState } from "react";
import { Download, LoaderCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function HukdisReportActions({ period }: { period: string }) {
  const [downloading, setDownloading] = useState(false);

  async function downloadDocx() {
    setDownloading(true);
    try {
      const response = await fetch("/api/hukdis/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "DOCX gagal dibuat.");
      }
      const disposition = response.headers.get("content-disposition");
      const fileName = disposition?.match(/filename="([^"]+)"/)?.[1] ?? `Daftar-Hukdis-${period}.docx`;
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Daftar Hukdis berhasil diunduh dalam format DOCX.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "DOCX gagal dibuat.");
    } finally {
      setDownloading(false);
    }
  }

  return <div className="hukdis-screen-actions flex flex-wrap gap-2">
    <Button type="button" variant="outline" onClick={() => window.print()}><Printer className="size-4" />Cetak daftar</Button>
    <Button type="button" onClick={downloadDocx} disabled={downloading}>
      {downloading ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
      {downloading ? "Menyiapkan DOCX..." : "Unduh DOCX"}
    </Button>
  </div>;
}
