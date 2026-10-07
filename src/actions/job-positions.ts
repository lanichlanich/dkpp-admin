"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";

const text = (label: string, max = 200) => z.string().trim().min(1, `${label} wajib diisi.`).max(max, `${label} terlalu panjang.`);
const positionSchema = z.object({
  id: z.string().trim().max(80),
  name: text("Nama jabatan"),
  unit: text("Unit organisasi"),
  positionType: z.enum(["JS", "JF", "JFU"], { error: "Pilih jenis jabatan yang valid." }),
  echelon: text("Eselon", 30),
  parentId: z.string().trim().max(80),
});

export type JobPositionFormState = {
  status?: "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
  submittedAt?: number;
};

function refreshPositionPages() {
  revalidatePath("/dashboard/jabatan");
  revalidatePath("/dashboard/pegawai");
  revalidatePath("/dashboard", "layout");
}

export async function saveJobPositionAction(_state: JobPositionFormState, formData: FormData): Promise<JobPositionFormState> {
  await requireUser();
  const parsed = positionSchema.safeParse({
    id: formData.get("id"), name: formData.get("name"), unit: formData.get("unit"),
    positionType: formData.get("positionType"), echelon: formData.get("echelon"), parentId: formData.get("parentId"),
  });
  if (!parsed.success) return { status: "error", errors: parsed.error.flatten().fieldErrors, submittedAt: Date.now() };

  const { id, name, unit, positionType, echelon } = parsed.data;
  const parentId = parsed.data.parentId || null;
  if (parentId) {
    const parent = await db.prepare("SELECT id FROM job_positions WHERE id = ?").get(parentId);
    if (!parent) return { status: "error", message: "Atasan yang dipilih tidak tersedia.", submittedAt: Date.now() };
    if (parentId === id) return { status: "error", message: "Jabatan tidak dapat menjadi atasannya sendiri.", submittedAt: Date.now() };
  }

  const duplicate = await db.prepare(`SELECT id FROM job_positions
    WHERE lower(name) = lower(?) AND lower(unit) = lower(?) AND position_type = ? AND echelon = ? AND id <> ? LIMIT 1`).get(name, unit, positionType, echelon, id) as { id: string } | undefined;
  if (duplicate) return { status: "error", message: "Jabatan dengan nama dan unit tersebut sudah terdaftar.", submittedAt: Date.now() };

  if (id) {
    const existing = await db.prepare(`SELECT name, unit, position_type, echelon
      FROM job_positions WHERE id = ?`).get(id) as { name: string; unit: string; position_type: string; echelon: string } | undefined;
    if (!existing) return { status: "error", message: "Jabatan tidak ditemukan.", submittedAt: Date.now() };
    const rows = await db.prepare("SELECT id, parent_id FROM job_positions").all() as Array<{ id: string; parent_id: string | null }>;
    const parents = new Map(rows.map((row) => [row.id, row.parent_id]));
    let current = parentId;
    const visited = new Set<string>();
    while (current) {
      if (current === id || visited.has(current)) return { status: "error", message: "Perubahan ini akan membentuk hirarki melingkar.", submittedAt: Date.now() };
      visited.add(current);
      current = parents.get(current) ?? null;
    }
    const updatedAt = new Date().toISOString();
    const statements = [{
      sql: `UPDATE job_positions SET name = ?, unit = ?, position_type = ?, echelon = ?, parent_id = ?, updated_at = ? WHERE id = ?`,
      values: [name, unit, positionType, echelon, parentId, updatedAt, id],
    }];
    if (existing.name !== name || existing.unit !== unit || existing.position_type !== positionType || existing.echelon !== echelon) {
      statements.push({
        sql: `UPDATE employees SET position = ?, unit = ?, position_type = ?, echelon = ?, updated_at = ? WHERE job_position_id = ?`,
        values: [name, unit, positionType, echelon, updatedAt, id],
      });
    }
    await db.transaction(statements);
  } else {
    await db.prepare(`INSERT INTO job_positions
      (id, name, unit, position_type, echelon, parent_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(randomUUID(), name, unit, positionType, echelon, parentId, new Date().toISOString(), new Date().toISOString());
  }

  refreshPositionPages();
  return { status: "success", message: id ? "Data jabatan diperbarui." : "Jabatan ditambahkan ke daftar.", submittedAt: Date.now() };
}

export async function moveJobPositionAction(id: string, parentId: string | null) {
  await requireUser();
  const parsedId = z.string().uuid().safeParse(id);
  const parsedParentId = parentId === null ? { success: true as const, data: null } : z.string().uuid().safeParse(parentId);
  if (!parsedId.success || !parsedParentId.success) return { success: false, message: "Data jabatan tidak valid." };

  const rows = await db.prepare("SELECT id, parent_id FROM job_positions").all() as Array<{ id: string; parent_id: string | null }>;
  const parents = new Map(rows.map((row) => [row.id, row.parent_id]));
  if (!parents.has(parsedId.data)) return { success: false, message: "Jabatan yang dipindahkan tidak ditemukan." };
  const nextParentId = parsedParentId.data;
  if (nextParentId && !parents.has(nextParentId)) return { success: false, message: "Jabatan atasan tidak ditemukan." };
  if (nextParentId === parsedId.data) return { success: false, message: "Jabatan tidak dapat menjadi atasannya sendiri." };
  if (parents.get(parsedId.data) === nextParentId) return { success: true, message: "Posisi jabatan tidak berubah." };

  const visited = new Set<string>();
  let current = nextParentId;
  while (current) {
    if (current === parsedId.data || visited.has(current)) {
      return { success: false, message: "Jabatan tidak dapat dipindahkan ke bawah dirinya sendiri." };
    }
    visited.add(current);
    current = parents.get(current) ?? null;
  }

  await db.prepare("UPDATE job_positions SET parent_id = ?, updated_at = ? WHERE id = ?")
    .run(nextParentId, new Date().toISOString(), parsedId.data);
  refreshPositionPages();
  return { success: true, message: "Hirarki jabatan berhasil diperbarui." };
}

export async function deleteJobPositionAction(id: string) {
  await requireUser();
  const safeId = z.string().uuid().safeParse(id);
  if (!safeId.success) return { success: false, message: "ID jabatan tidak valid." };
  const counts = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM employees WHERE job_position_id = ?) AS employee_count,
    (SELECT COUNT(*) FROM job_positions WHERE parent_id = ?) AS child_count`)
    .get(safeId.data, safeId.data) as { employee_count: number; child_count: number } | undefined;
  if (!counts) return { success: false, message: "Jabatan tidak ditemukan." };
  if (counts.employee_count) return { success: false, message: "Jabatan masih digunakan oleh pegawai. Ubah penempatan pegawai terlebih dahulu." };
  if (counts.child_count) return { success: false, message: "Jabatan masih membawahi jabatan lain. Atur ulang hirarki terlebih dahulu." };
  const result = await db.prepare("DELETE FROM job_positions WHERE id = ?").run(safeId.data);
  if (!result.changes) return { success: false, message: "Jabatan tidak ditemukan." };
  refreshPositionPages();
  return { success: true, message: "Jabatan berhasil dihapus." };
}
