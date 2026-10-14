import "server-only";
import { database as db } from "@/lib/database";
import { requireAdministrator } from "@/lib/authorization";
import { parseMenuPermissions } from "@/lib/access-control";
export type ManagedRole = { id: string; name: string; isAdministrator: boolean; menus: string[] };
export type ManagedUser = { id: string; name: string; username: string; email: string; roleId: string; active: boolean; protectedAdministrator: boolean; menus: string[] | null };
export async function getUserManagement() {
  await requireAdministrator();
  const roleRows = await db.prepare("SELECT id, name, is_administrator, menu_permissions FROM app_roles ORDER BY name").all<{ id: string; name: string; is_administrator: number; menu_permissions: string }>();
  const userRows = await db.prepare("SELECT id, name, username, email, role_id, is_active, protected_administrator, menu_permissions FROM users ORDER BY name").all<{ id: string; name: string; username: string; email: string; role_id: string; is_active: number; protected_administrator: number; menu_permissions: string | null }>();
  return {
    roles: roleRows.map(row => ({ id: row.id, name: row.name, isAdministrator: row.is_administrator === 1, menus: parseMenuPermissions(row.menu_permissions) })),
    users: userRows.map(row => ({ id: row.id, name: row.name, username: row.username, email: row.email, roleId: row.role_id, active: row.is_active === 1, protectedAdministrator: row.protected_administrator === 1, menus: row.menu_permissions === null ? null : parseMenuPermissions(row.menu_permissions) })),
  };
}
