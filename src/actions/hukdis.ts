"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { database as db } from "@/lib/database";
import { hukdisSanctions } from "@/lib/hukdis-types";
import { createNotification } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

const sanctionCodes = hukdisSanctions.map((sanction) => sanction.code) as [
  (typeof hukdisSanctions)[number]["code"],
  ...(typeof hukdisSanctions)[number]["code"][],
];

const hukdisSchema = z.object({
  employeeNip: z.string().regex(/^\d{18}$/, "NIP pegawai tidak valid."),
  reportPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Periode laporan tidak valid."),
  sanctionCode: z.union([z.enum(sanctionCodes), z.literal("none")]),
  decisionNumber: z.string().trim().max(160, "Nomor keputusan terlalu panjang."),
  decisionDate: z.string().trim(),
}).superRefine((value, context) => {
  if (value.sanctionCode === "none") return;
  if (!value.decisionNumber) {
    context.addIssue({ code: "custom", path: ["decisionNumber"], message: "Nomor keputusan wajib diisi." });
  }
  const parsedDate = new Date(`${value.decisionDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value.decisionDate) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== value.decisionDate
  ) {
    context.addIssue({ code: "custom", path: ["decisionDate"], message: "Tanggal keputusan wajib diisi dengan benar." });
  }
});

export type HukdisFormState = {
  status?: "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
  submittedAt?: number;
};

export async function saveHukdisAction(
  _state: HukdisFormState,
  formData: FormData,
): Promise<HukdisFormState> {
  const user = await requireUser();
  const parsed = hukdisSchema.safeParse({
    employeeNip: formData.get("employeeNip"),
    reportPeriod: formData.get("reportPeriod"),
    sanctionCode: formData.get("sanctionCode"),
    decisionNumber: String(formData.get("decisionNumber") ?? ""),
    decisionDate: String(formData.get("decisionDate") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors, submittedAt: Date.now() };
  }

  const employee = await db.prepare(
    "SELECT name FROM employees WHERE nip = ? AND status = 'Aktif'",
  ).get(parsed.data.employeeNip) as { name: string } | undefined;
  if (!employee) {
    return { status: "error", message: "Pegawai aktif tidak ditemukan.", submittedAt: Date.now() };
  }

  if (parsed.data.sanctionCode === "none") {
    await db.prepare(
      "DELETE FROM hukdis_records WHERE employee_nip = ? AND report_period = ?",
    ).run(parsed.data.employeeNip, parsed.data.reportPeriod);
    await createNotification(user.id, "info", "Data Hukdis dikosongkan", `Data Hukdis ${employee.name} untuk periode ${parsed.data.reportPeriod} dikosongkan.`);
  } else {
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO hukdis_records (
        employee_nip, report_period, sanction_code, decision_number,
        decision_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(employee_nip, report_period) DO UPDATE SET
        sanction_code = excluded.sanction_code,
        decision_number = excluded.decision_number,
        decision_date = excluded.decision_date,
        updated_at = excluded.updated_at`,
    ).run(
      parsed.data.employeeNip,
      parsed.data.reportPeriod,
      parsed.data.sanctionCode,
      parsed.data.decisionNumber,
      parsed.data.decisionDate,
      now,
      now,
    );
    await createNotification(user.id, "success", "Data Hukdis disimpan", `Data Hukdis ${employee.name} untuk periode ${parsed.data.reportPeriod} berhasil disimpan.`);
  }

  revalidatePath("/dashboard/hukdis");
  revalidatePath("/dashboard", "layout");
  return { status: "success", message: "Data Hukdis berhasil disimpan.", submittedAt: Date.now() };
}
