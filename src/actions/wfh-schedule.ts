"use server";

import { revalidatePath } from "next/cache";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";
import { fridayDates, getScheduleEntries, groupScheduleEntries, monthLabel, nextPeriod, validPeriod, type WorkLocation } from "@/lib/wfh-schedule";
import { continueFridayStatuses } from "@/lib/wfh-schedule-pattern";

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
    "SELECT period FROM wfh_schedule_months WHERE period = ?",
  ).get(nextPeriod(period, -1)) as { period: string } | undefined;
  if (!source) return { success: false, message: `Jadwal ${monthLabel(nextPeriod(period, -1))} belum tersedia.` };
  const sourceEntries = source ? await getScheduleEntries(source.period) : [];
  const sourcePeople = groupScheduleEntries(sourceEntries);
  if (!sourcePeople.length) return { success: false, message: "Daftar bulan sebelumnya kosong." };
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
    const statuses = continueFridayStatuses(previous, dates.length);
    const sortOrder = sourceEntries.find((entry) => entry.employeeNip === employee.nip)?.sortOrder ?? 9999;
    for (const [index, date] of dates.entries()) {
      values.push(period, employee.nip, employee.name, employee.position, employee.unit,
        sortOrder, date, statuses[index], user.id, now);
    }
  }
  if (!values.length) return { success: false, message: "Tidak ada pegawai aktif dari bulan sebelumnya." };

  try {
    const placeholders = Array.from({ length: values.length / 10 }, () => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    await db.transaction([
      { sql: "INSERT INTO wfh_schedule_months (period, source_period, created_by, created_at) VALUES (?, ?, ?, ?)", values: [period, source.period, user.id, now] },
      { sql: `INSERT INTO wfh_schedule_entries
        (period, employee_nip, employee_name, position, unit, sort_order, friday_date, status, updated_by, updated_at)
        VALUES ${placeholders}`, values },
    ]);
  } catch (error) {
    console.error("WFH schedule month creation failed", error);
    return { success: false, message: "Jadwal bulan gagal dibuat. Silakan coba lagi." };
  }
  refreshSchedule();
  return { success: true, message: `Jadwal ${monthLabel(period)} dilanjutkan dari ${monthLabel(source.period)}.` };
}

export async function continueScheduleMonth(period: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!validPeriod(period)) return { success: false, message: "Bulan tidak valid." };
  const targetPeriod = nextPeriod(period, 1);
  const [sourceMonth, targetMonth] = await Promise.all([
    db.prepare("SELECT period FROM wfh_schedule_months WHERE period = ?").get(period),
    db.prepare("SELECT period FROM wfh_schedule_months WHERE period = ?").get(targetPeriod),
  ]);
  if (!sourceMonth) return { success: false, message: `Jadwal ${monthLabel(period)} belum tersedia.` };

  const sourceEntries = await getScheduleEntries(period);
  const sourcePeople = groupScheduleEntries(sourceEntries);
  if (!sourcePeople.length) return { success: false, message: "Daftar bulan ini kosong. Bulan berikutnya tidak diubah." };
  const activeRows = await db.prepare(
    "SELECT nip, name, position, unit FROM employees WHERE status = 'Aktif'",
  ).all() as Array<{ nip: string; name: string; position: string; unit: string }>;
  const activeByNip = new Map(activeRows.map((row) => [row.nip, row]));
  const dates = fridayDates(targetPeriod);
  const now = new Date().toISOString();
  const values: Array<string | number> = [];
  for (const row of sourcePeople) {
    const employee = activeByNip.get(row.employee.nip);
    if (!employee) continue;
    const previous = [...row.statuses.values()];
    const statuses = continueFridayStatuses(previous, dates.length);
    const sortOrder = sourceEntries.find((entry) => entry.employeeNip === employee.nip)?.sortOrder ?? 9999;
    for (const [index, date] of dates.entries()) {
      values.push(targetPeriod, employee.nip, employee.name, employee.position, employee.unit,
        sortOrder, date, statuses[index], user.id, now);
    }
  }
  if (!values.length) return { success: false, message: "Tidak ada pegawai aktif dari bulan ini. Bulan berikutnya tidak diubah." };

  const placeholders = Array.from({ length: values.length / 10 }, () => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
  try {
    await db.transaction([
      targetMonth
        ? { sql: "UPDATE wfh_schedule_months SET source_period = ? WHERE period = ?", values: [period, targetPeriod] }
        : { sql: "INSERT INTO wfh_schedule_months (period, source_period, created_by, created_at) VALUES (?, ?, ?, ?)", values: [targetPeriod, period, user.id, now] },
      ...(targetMonth ? [{ sql: "DELETE FROM wfh_schedule_entries WHERE period = ?", values: [targetPeriod] }] : []),
      { sql: `INSERT INTO wfh_schedule_entries
        (period, employee_nip, employee_name, position, unit, sort_order, friday_date, status, updated_by, updated_at)
        VALUES ${placeholders}`, values },
    ]);
  } catch (error) {
    console.error("WFH schedule continuation failed", error);
    return { success: false, message: "Melanjutkan jadwal gagal. Bulan berikutnya tidak diubah." };
  }
  refreshSchedule();
  return { success: true, message: `Daftar ${monthLabel(targetPeriod)} ${targetMonth ? "diperbarui" : "dibuat"} sebagai kelanjutan ${monthLabel(period)}.` };
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
