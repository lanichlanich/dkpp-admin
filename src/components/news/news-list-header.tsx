import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  emerald: "from-emerald-100/75 dark:from-emerald-950/70 [&_.news-mark]:bg-emerald-600",
  indigo: "from-indigo-100/75 dark:from-indigo-950/70 [&_.news-mark]:bg-indigo-600",
  violet: "from-violet-100/75 dark:from-violet-950/70 [&_.news-mark]:bg-violet-600",
};

export function NewsListHeader({ icon: Icon, tone, title, description, children }: { icon: LucideIcon; tone: keyof typeof tones; title: string; description: string; children?: ReactNode }) {
  return <header className={cn("flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-linear-to-br to-card p-4 sm:p-5", tones[tone])}>
    <div className="flex min-w-0 items-start gap-3"><span className="news-mark grid size-11 shrink-0 place-items-center rounded-xl text-white"><Icon className="size-5" aria-hidden/></span><div><p className="text-xs font-semibold text-muted-foreground">Ruang Redaksi</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>
    {children}
  </header>;
}
