import "server-only";

import { cache } from "react";
import { db } from "@/lib/db";
import type { HukdisRecord, HukdisSanctionCode } from "@/lib/hukdis-types";
import { requireUser } from "@/lib/session";

type HukdisRow = {
  employee_nip: string;
  report_period: string;
  sanction_code: HukdisSanctionCode;
  decision_number: string;
  decision_date: string;
};

export const getHukdisRecords = cache(async (period: string): Promise<HukdisRecord[]> => {
  await requireUser();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return [];

  const rows = db.prepare(
    `SELECT employee_nip, report_period, sanction_code, decision_number, decision_date
     FROM hukdis_records
     WHERE report_period = ?`,
  ).all(period) as HukdisRow[];

  return rows.map((row) => ({
    employeeNip: row.employee_nip,
    reportPeriod: row.report_period,
    sanctionCode: row.sanction_code,
    decisionNumber: row.decision_number,
    decisionDate: row.decision_date,
  }));
});
