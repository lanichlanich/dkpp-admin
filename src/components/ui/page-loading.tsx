import { LoaderCircle } from "lucide-react";

export function PageLoading({ label = "Memuat halaman..." }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[50vh] items-center justify-center px-4"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-8 py-7 shadow-sm">
        <span className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin" />
        </span>
        <p className="text-sm font-medium text-zinc-700">{label}</p>
      </div>
    </div>
  );
}
