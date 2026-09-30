"use server";

import { revalidatePath } from "next/cache";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";
import { fridayDates, getScheduleEntries, groupScheduleEntries, monthLabel, nextPeriod, validPeriod, type WorkLocation } from "@/lib/wfh-schedule";

type ActionResult = { success: boolean; message: string };

function refreshSchedule() {
  revalidatePath("/dashboard/daftar-wfh");
  revalidatePath("/dashboard/laporan-pegawai-wfh-wfo");
}

export async function createScheduleMonth(period: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!validPeriod(period)) return { success: false, message: "Bulan tidak valid." };
  const existing = await db.prepare("SELECT period FROM wfh_schedule_months WHERE period = ?").get(period);
  if (existing) return { success: false, message: "Jadwal bulan ini sudah tersedia." };

  const source = await db.prepare(
    "SELECT period FROM wfh_schedule_months WHERE period < ? ORDER BY period DESC LIMIT 1",
  ).get(period) as { period: string } | undefined;
  const sourceEntries = source ? await getScheduleEntries(source.period) : [];
  const sourcePeople = groupScheduleEntries(sourceEntries);
  const activeRows = await db.prepare(
    "SELECT nip, name, position, unit FROM employees WHERE status = 'Aktif'",
  ).all() as Array<{ nip: string; name: string; position: string; unit: string }>;
  const activeByNip = new Map(activeRows.map((row) => [row.nip, row]));
  const dates = fridayDates(period);
  const now = new Date().toISOString();
  const values: Array<string | number> = [];
  for (const row of sourcePeople) {
    const employee = activeByNip.get(row.employee.nip);
    if (!employee) continue;
    const previous = [...row.statuses.values()];
    const sortOrder = sourceEntries.find((entry) => entry.employeeNip === employee.nip)?.sortOrder ?? 9999;
    for (const [index, date] of dates.entries()) {
      values.push(period, employee.nip, employee.name, employee.position, employee.unit,
        sortOrder, date, previous[index] ?? previous.at(-1) ?? "WFO", user.id, now);
    }
  }

  try {
    await db.prepare(
      "INSERT INTO wfh_schedule_months (period, source_period, created_by, created_at) VALUES (?, ?, ?, ?)",
    ).run(period, source?.period ?? null, user.id, now);
    if (values.length) {
      const placeholders = Array.from({ length: values.length / 10 }, () => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
      await db.prepare(
        `INSERT INTO wfh_schedule_entries
         (period, employee_nip, employee_name, position, unit, sort_order, friday_date, status, updated_by, updated_at)
         VALUES ${placeholders}`,
      ).run(...values);
    }
  } catch (error) {
    console.error("WFH schedule month creation failed", error);
    return { success: false, message: "Jadwal bulan gagal dibuat. Silakan coba lagi." };
  }
  refreshSchedule();
  return { success: true, message: source ? `Jadwal ${monthLabel(period)} dibuat dari ${monthLabel(source.period)}.` : `Jadwal ${monthLabel(period)} dibuat.` };
}

export async function regenerateScheduleMonth(period: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!validPeriod(period)) return { success: false, message: "Bulan tidak valid." };
  const previousPeriod = nextPeriod(period, -1);
  const [month, previousMonth] = await Promise.all([
    db.prepare("SELECT period FROM wfh_schedule_months WHERE period = ?").get(period),
    db.prepare("SELECT period FROM wfh_schedule_months WHERE period = ?").get(previousPeriod),
  ]);
  if (!month) return { success: false, message: "Buat jadwal bulan ini terlebih dahulu." };
  if (!previousMonth) return { success: false, message: `Jadwal ${monthLabel(previousPeriod)} belum tersedia.` };

  const sourceEntries = await getScheduleEntries(previousPeriod);
  const sourcePeople = groupScheduleEntries(sourceEntries);
  if (!sourcePeople.length) return { success: false, message: "Daftar bulan sebelumnya kosong. Jadwal saat ini tidak diubah." };
  const activeRows = await db.prepare(
    "SELECT nip, name, position, unit FROM employees WHERE status = 'Aktif'",
  ).all() as Array<{ nip: string; name: string; position: string; unit: string }>;
  const activeByNip = new Map(activeRows.map((row) => [row.nip, row]));
  const dates = fridayDates(period);
  const now = new Date().toISOString();
  const values: Array<string | number> = [];
  for (const row of sourcePeople) {
    const employee = activeByNip.get(row.employee.nip);
    if (!employee) continue;
    const previous = [...row.statuses.values()];
    const sortOrder = sourceEntries.find((entry) => entry.employeeNip === employee.nip)?.sortOrder ?? 9999;
    for (const [index, date] of dates.entries()) {
      values.push(period, employee.nip, employee.name, employee.position, employee.unit,
        sortOrder, date, previous[index] ?? previous.at(-1) ?? "WFO", user.id, now);
    }
  }
  if (!values.length) return { success: false, message: "Tidak ada pegawai aktif dari bulan sebelumnya. Jadwal saat ini tidak diubah." };

  const placeholders = Array.from({ length: values.length / 10 }, () => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
  try {
    await db.transaction([
      { sql: "UPDATE wfh_schedule_months SET source_period = ? WHERE period = ?", values: [previousPeriod, period] },
      { sql: "DELETE FROM wfh_schedule_entries WHERE period = ?", values: [period] },
      { sql: `INSERT INTO wfh_schedule_entries
        (period, employee_nip, employee_name, position, unit, sort_order, friday_date, status, updated_by, updated_at)
        VALUES ${placeholders}`, values },
    ]);
  } catch (error) {
    console.error("WFH schedule regeneration failed", error);
    return { success: false, message: "Generate ulang gagal. Jadwal sebelumnya tetap tersimpan." };
  }
  refreshSchedule();
  return { success: true, message: `Daftar ${monthLabel(period)} diperbarui dari ${monthLabel(previousPeriod)}.` };
}

export async function addScheduleEmployee(period: string, nip: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!validPeriod(period) || !/^\d{18}$/.test(nip)) return { success: false, message: "Data pegawai atau bulan tidak valid." };
  const month = await db.prepare("SELECT period FROM wfh_schedule_months WHERE period = ?").get(period);
  if (!month) return { success: false, message: "Buat jadwal bulan terlebih dahulu." };
  const employee = await db.prepare(
    "SELECT nip, name, position, unit FROM employees WHERE nip = ? AND status = 'Aktif'",
  ).get(nip) as { nip: string; name: string; position: string; unit: string } | undefined;
  if (!employee) return { success: false, message: "Pegawai aktif tidak ditemukan." };
  const now = new Date().toISOString();
  const orderRow = await db.prepare(
    "SELECT COALESCE(MAX(sort_order), 0) AS next_order FROM wfh_schedule_entries WHERE period = ?",
  ).get(period) as { next_order: number };
  const sortOrder = orderRow.next_order + 1;
  const dates = fridayDates(period);
  const placeholders = dates.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
  const added = (await db.prepare(
    `INSERT INTO wfh_schedule_entries
     (period, employee_nip, employee_name, position, unit, sort_order, friday_date, status, updated_by, updated_at)
     VALUES ${placeholders} ON CONFLICT DO NOTHING`,
  ).run(...dates.flatMap((date) => [period, nip, employee.name, employee.position, employee.unit, sortOrder, date, "WFO", user.id, now]))).changes;
  if (!added) return { success: false, message: "Pegawai sudah ada di daftar bulan ini." };
  refreshSchedule();
  return { success: true, message: `${employee.name} ditambahkan dengan status awal WFO.` };
}

export async function setScheduleStatus(period: string, nip: string, date: string, status: WorkLocation): Promise<ActionResult> {
  const user = await requireUser();
  if (!validPeriod(period) || !/^\d{18}$/.test(nip) || !fridayDates(period).includes(date) || !["WFH", "WFO"].includes(status)) {
    return { success: false, message: "Perubahan status tidak valid." };
  }
  const result = await db.prepare(
    `UPDATE wfh_schedule_entries SET status = ?, updated_by = ?, updated_at = ?
     WHERE period = ? AND employee_nip = ? AND friday_date = ?`,
  ).run(status, user.id, new Date().toISOString(), period, nip, date);
  if (!result.changes) return { success: false, message: "Jadwal pegawai tidak ditemukan." };
  refreshSchedule();
  return { success: true, message: `Status ${date} diubah menjadi ${status}.` };
}
