import { Archive, CalendarCog, ChartNoAxesCombined, ClipboardCheck, ClipboardPenLine, FileSpreadsheet, Paperclip, Target, UsersRound, Wallet } from "lucide-react";

export const actionIcons = {
  budget: Wallet, financial: ChartNoAxesCombined, assignment: UsersRound, target: Target,
  evaluation: ClipboardPenLine, review: ClipboardCheck, period: CalendarCog,
  upload: Paperclip, import: FileSpreadsheet, archive: Archive,
};
export const tones = {
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  sky: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
  amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  neutral: "border-border bg-muted text-foreground",
};
