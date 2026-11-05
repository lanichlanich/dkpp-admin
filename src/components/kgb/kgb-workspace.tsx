"use client";

import { useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { CalendarClock, FileText } from "lucide-react";
import { KgbCreateDialog } from "./kgb-create-dialog";
import { KgbHistory } from "./kgb-history";
import { KgbReminders } from "./kgb-reminders";
import type { KgbEmployee } from "@/lib/kgb";
import type { KgbDocumentHistory } from "@/lib/kgb-documents";
import type { KgbReminder } from "@/lib/kgb-reminders";
import { KGB_REMINDER_DAYS } from "@/lib/kgb-reminder-dates";
import type { SignatoryOption } from "@/lib/signatory";

const tabClass = "flex min-h-11 min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-indigo-500 data-active:bg-indigo-50 data-active:text-indigo-800";

export function KgbWorkspace({ initialTab, employees, signatories, documents, reminders, today }: {
  initialTab: string;
  employees: KgbEmployee[];
  signatories: SignatoryOption[];
  documents: KgbDocumentHistory[];
  reminders: KgbReminder[];
  today: string;
}) {
  const [tab, setTab] = useState(initialTab);
  const [archiveKey, setArchiveKey] = useState(0);
  const dueCount = reminders.filter(reminder => reminder.daysRemaining <= KGB_REMINDER_DAYS).length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-linear-to-br from-indigo-50 via-white to-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-indigo-700">Kepegawaian</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">SK Kenaikan Gaji Berkala</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Buat SK, kelola dokumen bertanda tangan, dan pantau jadwal KGB berikutnya.</p>
        </div>
        <KgbCreateDialog employees={employees} signatories={signatories} onSaved={() => {
          setTab("arsip");
          setArchiveKey(key => key + 1);
        }} />
      </header>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List aria-label="Menu SK KGB" className="mb-4 grid w-full grid-cols-2 gap-1 rounded-xl border bg-white p-1 sm:w-fit">
          <Tabs.Tab value="arsip" className={tabClass}>
            <FileText className="size-4 shrink-0" aria-hidden="true" />
            Arsip SK <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs tabular-nums">{documents.length}</span>
          </Tabs.Tab>
          <Tabs.Tab value="pengingat" className={tabClass}>
            <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
            Pengingat{dueCount > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900" title="Jatuh tempo dalam 90 hari atau terlewat">{dueCount}<span className="sr-only"> perlu perhatian</span></span>}
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="arsip" keepMounted className="outline-none">
          <KgbHistory key={archiveKey} documents={documents} />
        </Tabs.Panel>
        <Tabs.Panel value="pengingat" keepMounted className="outline-none">
          <KgbReminders reminders={reminders} initialToday={today} />
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  );
}
