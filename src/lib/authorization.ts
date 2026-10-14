import "server-only";
import { redirect } from "next/navigation";
import { canAccessMenu, landingPath } from "@/lib/access-control";
import { getCurrentUser, requireUser } from "@/lib/session";

export async function requireMenuAccess(menu: string) {
  const user = await requireUser();
  if (!canAccessMenu(user, menu)) redirect(landingPath(user));
  return user;
}
export async function requireAdministrator() {
  const user = await requireUser();
  if (!user.isAdministrator) throw new Error("Hanya administrator yang dapat mengelola pengguna dan role.");
  return user;
}
export async function checkApiAccess(menus: string[]) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Silakan masuk kembali." }, { status: 401 });
  if (!menus.some(menu => canAccessMenu(user, menu))) return Response.json({ message: "Anda tidak memiliki akses ke fitur ini." }, { status: 403 });
  return null;
}
