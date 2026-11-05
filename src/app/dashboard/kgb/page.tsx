import { requireMenuAccess } from "@/lib/authorization";
import { getSignatoryOptions } from "@/lib/signatory-options";
import type { Metadata } from "next";
import { KgbWorkspace } from "@/components/kgb/kgb-workspace";
import { getKgbEmployeeOptions } from "@/lib/employees";
import { getKgbHistory } from "@/lib/kgb-documents";
import { getKgbReminders } from "@/lib/kgb-reminders";
import { jakartaToday } from "@/lib/plt-dates";

export const metadata: Metadata = { title: "SK KGB" };

export default async function KgbPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requireMenuAccess("kgb");
  const today = jakartaToday();
  const [employees, signatories, documents, reminders, params] = await Promise.all([
    getKgbEmployeeOptions(), getSignatoryOptions(), getKgbHistory(), getKgbReminders(today), searchParams,
  ]);
  const initialTab = params.tab === "pengingat" ? "pengingat" : "arsip";
  return (
    <KgbWorkspace key={initialTab} initialTab={initialTab} employees={employees} signatories={signatories}
      documents={documents} reminders={reminders} today={today} />
  );
}
