"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { database as db } from "@/lib/database";
import { createNotification } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

const requiredText = (label: string, max = 160) =>
  z.string().trim().min(1, `${label} wajib diisi.`).max(max, `${label} terlalu panjang.`);

const employeeSchema = z.object({
  nip: z.string().trim().regex(/^\d{18}$/, "NIP harus terdiri dari tepat 18 digit."),
  name: requiredText("Nama", 160),
  parentUnit: requiredText("Unor induk", 200),
  unit: requiredText("Unor", 200),
  position: requiredText("Jabatan", 200),
  positionType: requiredText("Jenis jabatan", 50),
  echelon: requiredText("Eselon", 30),
  rank: requiredText("Golongan/pangkat", 100),
  asnType: requiredText("Jenis ASN", 30),
  gender: z.enum(["Laki-laki", "Perempuan", "Tidak diketahui"], { error: "Pilih jenis kelamin pegawai." }),
  status: z.enum(["Aktif", "Pensiun", "Mutasi"], { error: "Pilih status pegawai." }),
});

export type EmployeeFormState = {
  status?: "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
  submittedAt?: number;
};

export async function saveEmployeeAction(
  _state: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const user = await requireUser();
  const parsed = employeeSchema.safeParse({
    nip: formData.get("nip"),
    name: formData.get("name"),
    parentUnit: formData.get("parentUnit"),
    unit: formData.get("unit"),
    position: formData.get("position"),
    positionType: formData.get("positionType"),
    echelon: formData.get("echelon"),
    rank: formData.get("rank"),
    asnType: formData.get("asnType"),
    gender: formData.get("gender"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors, submittedAt: Date.now() };
  }

  const mode = formData.get("mode") === "edit" ? "edit" : "create";
  const originalNip = String(formData.get("originalNip") ?? "");
  const employee = parsed.data;
  const now = new Date().toISOString();

  if (mode === "create") {
    const duplicate = await db.prepare("SELECT 1 FROM employees WHERE nip = ?").get(employee.nip);
    if (duplicate) {
      return { status: "error", message: "NIP sudah terdaftar.", submittedAt: Date.now() };
    }

    await db.prepare(
      `INSERT INTO employees (
        nip, name, parent_unit, unit, position, position_type, echelon,
        rank, asn_type, gender, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      employee.nip, employee.name, employee.parentUnit, employee.unit,
      employee.position, employee.positionType, employee.echelon, employee.rank,
      employee.asnType, employee.gender, employee.status, now, now,
    );
    await createNotification(user.id, "success", "Pegawai ditambahkan", `${employee.name} (${employee.nip}) berhasil ditambahkan.`);
  } else {
    if (!originalNip || originalNip !== employee.nip) {
      return { status: "error", message: "NIP primary key tidak dapat diubah.", submittedAt: Date.now() };
    }
    const result = await db.prepare(
      `UPDATE employees SET
        name = ?, parent_unit = ?, unit = ?, position = ?, position_type = ?,
        echelon = ?, rank = ?, asn_type = ?, gender = ?, status = ?, updated_at = ?
       WHERE nip = ?`,
    ).run(
      employee.name, employee.parentUnit, employee.unit, employee.position,
      employee.positionType, employee.echelon, employee.rank, employee.asnType,
      employee.gender, employee.status, now, employee.nip,
    );
    if (result.changes === 0) {
      return { status: "error", message: "Data pegawai tidak ditemukan.", submittedAt: Date.now() };
    }
    await createNotification(user.id, "info", "Data pegawai diperbarui", `${employee.name} (${employee.nip}) berhasil diperbarui.`);
  }

  revalidatePath("/dashboard/pegawai");
  revalidatePath("/dashboard", "layout");
  return {
    status: "success",
    message: mode === "create" ? "Pegawai berhasil ditambahkan." : "Data pegawai berhasil diperbarui.",
    submittedAt: Date.now(),
  };
}

const bulkSchema = z.object({
  nips: z.array(z.string().regex(/^\d{18}$/)).min(1).max(500),
  operation: z.enum(["activate", "retire", "mutate", "delete"]),
});

export async function bulkEmployeeAction(input: z.infer<typeof bulkSchema>) {
  const user = await requireUser();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Pilihan pegawai atau aksi tidak valid." };

  const placeholders = parsed.data.nips.map(() => "?").join(",");
  let changes = 0;
  if (parsed.data.operation === "delete") {
    changes = (await db.prepare(`DELETE FROM employees WHERE nip IN (${placeholders})`).run(...parsed.data.nips)).changes;
  } else {
    const status = parsed.data.operation === "activate" ? "Aktif" : parsed.data.operation === "mutate" ? "Mutasi" : "Pensiun";
    changes = (await db.prepare(
      `UPDATE employees SET status = ?, updated_at = ? WHERE nip IN (${placeholders})`,
    ).run(status, new Date().toISOString(), ...parsed.data.nips)).changes;
  }

  const notificationType = parsed.data.operation === "delete" ? "warning" : "success";
  const operationLabel = parsed.data.operation === "delete" ? "dihapus" : parsed.data.operation === "activate" ? "diaktifkan" : parsed.data.operation === "mutate" ? "dimutasikan" : "dipensiunkan";
  await createNotification(user.id, notificationType, "Aksi massal pegawai", `${changes} data pegawai berhasil ${operationLabel}.`);
  revalidatePath("/dashboard/pegawai");
  revalidatePath("/dashboard", "layout");
  return { success: true, message: `${changes} pegawai berhasil ${operationLabel}.` };
}
