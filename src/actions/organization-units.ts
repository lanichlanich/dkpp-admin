"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";

const schema = z.object({
  id: z.string().trim().max(80),
  name: z.string().trim().min(1, "Nama unit wajib diisi.").max(200, "Nama unit terlalu panjang."),
  parentId: z.string().trim().max(80),
});

export type OrganizationUnitFormState = {
  status?: "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
  submittedAt?: number;
};

function refreshUnitPages() {
  revalidatePath("/dashboard/unit-organisasi");
  revalidatePath("/dashboard/jabatan");
  revalidatePath("/dashboard/pegawai");
  revalidatePath("/dashboard", "layout");
}

export async function saveOrganizationUnitAction(_state: OrganizationUnitFormState, formData: FormData): Promise<OrganizationUnitFormState> {
  await requireUser();
  const parsed = schema.safeParse({
    id: formData.get("id"), name: formData.get("name"), parentId: formData.get("parentId"),
  });
  if (!parsed.success) return { status: "error", errors: parsed.error.flatten().fieldErrors, submittedAt: Date.now() };

  const { id, name } = parsed.data;
  const parentId = parsed.data.parentId || null;
  if (parentId) {
    const parent = await db.prepare("SELECT id FROM organization_units WHERE id = ?").get(parentId);
    if (!parent) return { status: "error", message: "Unit induk yang dipilih tidak tersedia.", submittedAt: Date.now() };
    if (id && parentId === id) return { status: "error", message: "Unit tidak dapat menjadi induk bagi dirinya sendiri.", submittedAt: Date.now() };
  }

  const duplicate = await db.prepare(`SELECT id FROM organization_units
    WHERE lower(name) = lower(?) AND id <> ? LIMIT 1`).get(name, id) as { id: string } | undefined;
  if (duplicate) return { status: "error", message: "Nama unit tersebut sudah terdaftar.", submittedAt: Date.now() };

  if (id) {
    const existing = await db.prepare("SELECT name FROM organization_units WHERE id = ?").get(id) as { name: string } | undefined;
    if (!existing) return { status: "error", message: "Unit organisasi tidak ditemukan.", submittedAt: Date.now() };
    const rows = await db.prepare("SELECT id, parent_id FROM organization_units").all() as Array<{ id: string; parent_id: string | null }>;
    const parents = new Map(rows.map((row) => [row.id, row.parent_id]));
    let current = parentId;
    const visited = new Set<string>();
    while (current) {
      if (current === id || visited.has(current)) return { status: "error", message: "Perubahan ini akan membentuk hirarki unit melingkar.", submittedAt: Date.now() };
      visited.add(current);
      current = parents.get(current) ?? null;
    }
    const updatedAt = new Date().toISOString();
    const statements = [{
      sql: "UPDATE organization_units SET name = ?, parent_id = ?, updated_at = ? WHERE id = ?",
      values: [name, parentId, updatedAt, id],
    }];
    if (existing.name !== name) {
      statements.push({
        sql: "UPDATE job_positions SET unit = ?, updated_at = ? WHERE organization_unit_id = ?",
        values: [name, updatedAt, id],
      });
      statements.push({
        sql: `UPDATE employees SET unit = ?, updated_at = ?
          WHERE job_position_id IN (SELECT id FROM job_positions WHERE organization_unit_id = ?)`,
        values: [name, updatedAt, id],
      });
    }
    await db.transaction(statements);
  } else {
    await db.prepare(`INSERT INTO organization_units (id, name, parent_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`)
      .run(randomUUID(), name, parentId, new Date().toISOString(), new Date().toISOString());
  }

  refreshUnitPages();
  return { status: "success", message: id ? "Unit organisasi diperbarui." : "Unit organisasi ditambahkan.", submittedAt: Date.now() };
}

export async function deleteOrganizationUnitAction(id: string) {
  await requireUser();
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return { success: false, message: "ID unit organisasi tidak valid." };
  const counts = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM job_positions WHERE organization_unit_id = ?) AS position_count,
    (SELECT COUNT(*) FROM organization_units WHERE parent_id = ?) AS child_count`)
    .get(parsedId.data, parsedId.data) as { position_count: number; child_count: number } | undefined;
  if (!counts) return { success: false, message: "Unit organisasi tidak ditemukan." };
  if (counts.position_count) return { success: false, message: "Unit masih digunakan oleh jabatan. Pindahkan jabatan terlebih dahulu." };
  if (counts.child_count) return { success: false, message: "Unit masih membawahi unit lain. Atur ulang hirarki terlebih dahulu." };
  const result = await db.prepare("DELETE FROM organization_units WHERE id = ?").run(parsedId.data);
  if (!result.changes) return { success: false, message: "Unit organisasi tidak ditemukan." };
  refreshUnitPages();
  return { success: true, message: "Unit organisasi berhasil dihapus." };
}
