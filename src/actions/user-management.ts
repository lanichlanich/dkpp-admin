"use server";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { database as db } from "@/lib/database";
import { requireAdministrator } from "@/lib/authorization";
import { MENU_CATALOG } from "@/lib/access-control";
import { editUserSchema, registerSchema } from "@/lib/validation";
import { deleteSession } from "@/lib/session";
export type ManagementState = { status?: "success" | "error"; message?: string; submittedAt?: number };
const menuSchema = z.array(z.string()).max(MENU_CATALOG.length).refine(ids => ids.every(id => MENU_CATALOG.some(menu => menu.id === id)), "Menu tidak valid.");
const result = (success: boolean, message: string): ManagementState => ({ status: success ? "success" : "error", message, submittedAt: Date.now() });
function refreshed(message: string) { revalidatePath("/dashboard", "layout"); return result(true, message); }

export async function saveRoleAction(_state: ManagementState, form: FormData): Promise<ManagementState> {
  await requireAdministrator();
  const parsed = z.object({ id: z.string().max(80), name: z.string().trim().min(2).max(80), menus: menuSchema }).safeParse({ id: String(form.get("id") ?? ""), name: form.get("name"), menus: form.getAll("menus") });
  if (!parsed.success) return result(false, "Periksa nama role dan pilihan menu.");
  const { id, name, menus } = parsed.data;
  if (["administrator", "unassigned"].includes(id)) return result(false, "Role sistem ini tidak dapat diubah.");
  if (id && !await db.prepare("SELECT id FROM app_roles WHERE id = ? AND is_administrator = 0").get(id)) return result(false, "Role tidak ditemukan.");
  if (await db.prepare("SELECT id FROM app_roles WHERE lower(name) = lower(?) AND id <> ?").get(name, id)) return result(false, "Nama role sudah digunakan.");
  const now = new Date().toISOString();
  if (id) await db.prepare("UPDATE app_roles SET name = ?, menu_permissions = ?, updated_at = ? WHERE id = ?").run(name, JSON.stringify([...new Set(menus)]), now, id);
  else await db.prepare("INSERT INTO app_roles (id, name, is_administrator, menu_permissions, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?)").run(randomUUID(), name, JSON.stringify([...new Set(menus)]), now, now);
  return refreshed("Role dan akses menu berhasil disimpan.");
}

export async function saveUserAccessAction(_state: ManagementState, form: FormData): Promise<ManagementState> {
  const actor = await requireAdministrator();
  const parsed = z.object({ id: z.string().min(1).max(80), roleId: z.string().min(1).max(80), menus: menuSchema }).safeParse({ id: form.get("id"), roleId: form.get("roleId"), menus: form.getAll("menus") });
  if (!parsed.success) return result(false, "Pilihan pengguna, role, atau menu tidak valid.");
  const target = await db.prepare("SELECT id, protected_administrator FROM users WHERE id = ?").get<{ id: string; protected_administrator: number }>(parsed.data.id);
  const role = await db.prepare("SELECT id, is_administrator FROM app_roles WHERE id = ?").get<{ id: string; is_administrator: number }>(parsed.data.roleId);
  if (!target || !role) return result(false, "Pengguna atau role tidak ditemukan.");
  const active = form.get("active") === "on";
  if ((target.protected_administrator === 1 || target.id === actor.id) && (!active || role.is_administrator !== 1)) return result(false, "Administrator utama dan akun Anda sendiri harus tetap aktif sebagai administrator.");
  const permissions = role.is_administrator === 1 || form.get("customMenus") !== "on" ? null : JSON.stringify([...new Set(parsed.data.menus)]);
  await db.transaction([
    { sql: "UPDATE users SET role_id = ?, is_active = ?, menu_permissions = ?, updated_at = ? WHERE id = ?", values: [role.id, active ? 1 : 0, permissions, new Date().toISOString(), target.id] },
    // Changes immediately affect existing sessions; remove them when an account is disabled.
    ...(!active ? [{ sql: "DELETE FROM sessions WHERE user_id = ?", values: [target.id] }] : []),
  ]);
  return refreshed("Role dan akses pengguna berhasil disimpan.");
}

export async function createUserAction(_state: ManagementState, form: FormData): Promise<ManagementState> {
  await requireAdministrator();
  const parsed = registerSchema.safeParse(Object.fromEntries(["name", "username", "email", "password", "confirmPassword"].map(key => [key, form.get(key)])));
  if (!parsed.success) return result(false, parsed.error.issues[0]?.message ?? "Periksa data pengguna.");
  const roleId = String(form.get("roleId") ?? "unassigned");
  if (!await db.prepare("SELECT id FROM app_roles WHERE id = ?").get(roleId)) return result(false, "Pilih role yang tersedia.");
  const { name, username, email, password } = parsed.data;
  if (await db.prepare("SELECT id FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?)").get(username, email)) return result(false, "Email atau username sudah digunakan.");
  const now = new Date().toISOString();
  await db.prepare("INSERT INTO users (id, name, username, email, password_hash, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(randomUUID(), name, username, email.toLowerCase(), await hash(password, 12), roleId, now, now);
  return refreshed("Pengguna berhasil ditambahkan.");
}

export async function editUserAction(_state: ManagementState, form: FormData): Promise<ManagementState> {
  const actor = await requireAdministrator();
  const parsed = editUserSchema.safeParse({
    ...Object.fromEntries(["id", "name", "username", "email"].map(key => [key, form.get(key)])),
    newPassword: form.get("newPassword") ?? "",
    confirmNewPassword: form.get("confirmNewPassword") ?? "",
  });
  if (!parsed.success) return result(false, parsed.error.issues[0]?.message ?? "Periksa data pengguna.");
  const { id, name, username, email, newPassword } = parsed.data;
  const target = await db.prepare("SELECT email, protected_administrator FROM users WHERE id = ?")
    .get<{ email: string; protected_administrator: number }>(id);
  if (!target) return result(false, "Pengguna tidak ditemukan.");
  if (target.protected_administrator === 1 && email.toLowerCase() !== target.email.toLowerCase()) {
    return result(false, "Email administrator utama tidak dapat diubah.");
  }
  if (await db.prepare("SELECT id FROM users WHERE id <> ? AND (lower(username) = lower(?) OR lower(email) = lower(?))").get(id, username, email)) {
    return result(false, "Email atau username sudah digunakan pengguna lain.");
  }
  try {
    const now = new Date().toISOString();
    if (newPassword) {
      const passwordHash = await hash(newPassword, 12);
      await db.transaction([
        { sql: "UPDATE users SET name = ?, username = ?, email = ?, password_hash = ?, updated_at = ? WHERE id = ?", values: [name, username, email.toLowerCase(), passwordHash, now, id] },
        { sql: "DELETE FROM sessions WHERE user_id = ?", values: [id] },
      ]);
    } else {
      const saved = await db.prepare("UPDATE users SET name = ?, username = ?, email = ?, updated_at = ? WHERE id = ?")
        .run(name, username, email.toLowerCase(), now, id);
      if (!saved.changes) return result(false, "Pengguna tidak ditemukan.");
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "23505" || code === "SQLITE_CONSTRAINT_UNIQUE") return result(false, "Email atau username sudah digunakan pengguna lain.");
    return result(false, "Data pengguna tidak dapat diperbarui. Silakan coba lagi.");
  }
  if (newPassword && id === actor.id) {
    await deleteSession();
    redirect("/login");
  }
  return refreshed(newPassword ? "Data dan password pengguna berhasil diperbarui. Pengguna perlu login ulang." : "Data pengguna berhasil diperbarui.");
}

export async function deleteRoleAction(_state: ManagementState, form: FormData): Promise<ManagementState> {
  await requireAdministrator();
  const id = String(form.get("id") ?? "");
  if (!id || ["administrator", "perencana", "unassigned"].includes(id)) return result(false, "Role bawaan tidak dapat dihapus.");
  if (await db.prepare("SELECT id FROM users WHERE role_id = ?").get(id)) return result(false, "Role masih digunakan. Pindahkan pengguna ke role lain terlebih dahulu.");
  await db.prepare("DELETE FROM app_roles WHERE id = ? AND is_administrator = 0").run(id);
  return refreshed("Role berhasil dihapus.");
}
