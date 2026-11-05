import { addYearsToDate } from "@/lib/kgb";
import { validPltDate } from "@/lib/plt-dates";

export const KGB_REMINDER_DAYS = 90;
export function nextKgbDate(tmt: string) { return validPltDate(tmt) ? addYearsToDate(tmt, 2) : ""; }
export function kgbDaysRemaining(next: string, today: string) {
  return Math.round((new Date(`${next}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
}
export function kgbReminderStatus(days: number) {
  return days < 0 ? "overdue" : days === 0 ? "due" : days <= KGB_REMINDER_DAYS ? "upcoming" : "scheduled";
}
