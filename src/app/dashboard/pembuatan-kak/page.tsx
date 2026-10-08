import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getKakHistory } from "@/lib/kak";
import { getSignatoryOptions } from "@/lib/signatory-options";
import { KakForm } from "@/components/kak/form";
export const metadata: Metadata = { title: "Pembuatan KAK" };
export default async function KakPage() {
  await requireUser();
  const [history, signatories] = await Promise.all([getKakHistory(), getSignatoryOptions()]);
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date());
  return <div className="mx-auto max-w-6xl space-y-6"><div><p className="text-sm font-medium text-emerald-700">Perencanaan</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Pembuatan KAK</h1><p className="mt-2 text-sm text-zinc-500">Susun draft Kerangka Acuan Kerja dari RKA menggunakan template dan Gemini.</p></div><KakForm history={history} today={today} signatories={signatories} /></div>;
}
