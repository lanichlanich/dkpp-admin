import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { database as db } from "@/lib/database";
import type { ReportEmployee, WfhReportInput } from "@/lib/wfh-report-validation";

export async function getReportEmployee(nip: string) {
  return await db.prepare("SELECT nip, name, rank, position, unit FROM employees WHERE nip = ? AND status = 'Aktif'").get(nip) as ReportEmployee | undefined;
}
export async function getReportEmployees() {
  return await db.prepare("SELECT nip, name, rank, position, unit FROM employees WHERE status = 'Aktif' ORDER BY name COLLATE NOCASE").all() as ReportEmployee[];
}
export type ReportHistory = { id: string; employee_name: string; report_date: string; created_at: string; file_name: string };
export async function getReportHistory(userId: string) {
  // PostgreSQL returns DATE/TIMESTAMP columns as Date objects. Cast them in
  // SQL so the server component always passes renderable strings to React.
  return await db.prepare("SELECT id, employee_name, CAST(report_date AS TEXT) AS report_date, CAST(created_at AS TEXT) AS created_at, file_name FROM wfh_reports WHERE user_id = ? ORDER BY created_at DESC").all(userId) as ReportHistory[];
}
export function reportFilePath(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) throw new Error("ID laporan tidak valid.");
  return path.join(process.cwd(), "data", "wfh-reports", `${id}.docx`);
}
export async function saveReport(userId: string, employee: ReportEmployee, input: WfhReportInput, document: Buffer) {
  const id = randomUUID();
  const fileName = `Laporan-WFH-${input.date}-${employee.nip}.docx`;
  await mkdir(path.dirname(reportFilePath(id)), { recursive: true });
  await writeFile(reportFilePath(id), document, { flag: "wx" });
  try {
    await db.prepare("INSERT INTO wfh_reports VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, userId, employee.nip, employee.name, input.date, JSON.stringify({ ...input, employee }), fileName, new Date().toISOString());
  } catch (error) { await rm(reportFilePath(id), { force: true }); throw error; }
  return { id, fileName };
}
export async function findReport(id: string, userId: string) {
  return await db.prepare("SELECT file_name FROM wfh_reports WHERE id = ? AND user_id = ?").get(id, userId) as { file_name: string } | undefined;
}
