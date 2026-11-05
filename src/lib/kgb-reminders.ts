import "server-only";
import { database as db } from "@/lib/database";
import { jakartaToday } from "@/lib/plt-dates";
import { formatIndonesianDate } from "@/lib/kgb";
import { kgbDaysRemaining, kgbReminderStatus, nextKgbDate } from "@/lib/kgb-reminder-dates";

export type KgbReminder = { employeeNip: string; employeeName: string; currentTmt: string; nextTmt: string; documentId: string; signedId: string; daysRemaining: number };
export async function getKgbReminders(today = jakartaToday()): Promise<KgbReminder[]> {
  const rows = await db.prepare(`SELECT s.employee_nip, e.name AS employee_name, CAST(s.tmt_kgb AS TEXT) AS tmt_kgb, s.document_id, s.id
    FROM kgb_signed_documents s JOIN employees e ON e.nip=s.employee_nip
    WHERE e.asn_type='PNS' AND e.status='Aktif' AND s.tmt_kgb IS NOT NULL
    ORDER BY s.tmt_kgb DESC, s.created_at DESC, s.id DESC`)
    .all<{ employee_nip: string; employee_name: string; tmt_kgb: string; document_id: string; id: string }>();
  const latest = new Map<string, KgbReminder>();
  for (const row of rows) {
    const next = nextKgbDate(row.tmt_kgb); if (!next || latest.has(row.employee_nip)) continue;
    latest.set(row.employee_nip, { employeeNip: row.employee_nip, employeeName: row.employee_name, currentTmt: row.tmt_kgb, nextTmt: next,
      documentId: row.document_id, signedId: row.id, daysRemaining: kgbDaysRemaining(next, today) });
  }
  return [...latest.values()].sort((a, b) => a.nextTmt.localeCompare(b.nextTmt) || a.employeeName.localeCompare(b.employeeName, "id"));
}

export async function syncKgbReminderNotifications(userId: string, allowed: boolean, today = jakartaToday()) {
  const reminders = allowed ? (await getKgbReminders(today)).filter(r => kgbReminderStatus(r.daysRemaining) !== "scheduled") : [];
  const messages = reminders.map(r => {
    const status = kgbReminderStatus(r.daysRemaining), id = `kgb-reminder:${userId}:${r.employeeNip}:${r.nextTmt}:${status}`;
    const when = status === "overdue" ? `Terlewat ${-r.daysRemaining} hari` : status === "due" ? "Jatuh tempo hari ini" : `${r.daysRemaining} hari lagi`;
    return { id, description: `${r.employeeName} (${r.employeeNip}): KGB berikutnya ${formatIndonesianDate(r.nextTmt)}. ${when}. TMT KGB sekarang ${formatIndonesianDate(r.currentTmt)}.` };
  });
  const ids = messages.map(m => m.id), now = new Date().toISOString();
  await db.transaction([
    { sql: `DELETE FROM notifications WHERE user_id=? AND id LIKE 'kgb-reminder:%'${ids.length ? ` AND id NOT IN (${ids.map(() => "?").join(",")})` : ""}`, values: [userId, ...ids] },
    ...messages.map(m => ({ sql: `INSERT INTO notifications(id,user_id,type,title,description,created_at) VALUES(?,?,'warning','Pengingat KGB berikutnya',?,?)
      ON CONFLICT(id) DO UPDATE SET description=excluded.description`, values: [m.id, userId, m.description, now] })),
  ]);
}
