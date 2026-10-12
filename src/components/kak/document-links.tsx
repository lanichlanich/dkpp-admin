import { Download } from "lucide-react";
import type { KakReference } from "@/lib/kak-types";

export function DownloadLinks({ id, hasPo }: { id: string; hasPo: boolean }) {
  const linkClass = "inline-flex items-center gap-2 font-medium text-emerald-700 underline";
  return <div className="flex flex-col items-start gap-2">{hasPo && <><a href={`/api/kak/${id}/download?format=zip`} className={linkClass}><Download className="size-4" />PO dan KAK (ZIP)</a><a href={`/api/kak/${id}/download?source=po`} className={linkClass}>PO (DOCX)</a></>}<a href={`/api/kak/${id}/download`} className={linkClass}>KAK (DOCX)</a><a href={`/api/kak/${id}/download?source=rka`} className={linkClass}>RKA sumber (PDF)</a></div>;
}
export function ReferenceList({ references }: { references: KakReference[] }) {
  if (!references.length) return null;
  return <details className="text-sm text-emerald-800"><summary className="cursor-pointer font-medium">Sumber referensi yang digunakan</summary><ul className="mt-2 space-y-2">{references.map((r) => <li key={r.id}><p className="font-medium">{r.title}</p><p className="mt-1 text-xs text-zinc-500">{r.locators.join("; ")}</p></li>)}</ul></details>;
}
