import type { Metadata } from "next";
import { getUserManagement } from "@/lib/user-management";
import { UserManagement } from "@/components/users/user-management";
import { requireUser } from "@/lib/session";
import { landingPath } from "@/lib/access-control";
import { redirect } from "next/navigation";
export const metadata: Metadata = { title: "Manajemen User" };
export default async function UserManagementPage() {
  const actor = await requireUser();
  if (!actor.isAdministrator) redirect(landingPath(actor));
  const { users, roles } = await getUserManagement();
  return <div className="mx-auto max-w-6xl space-y-6"><div><p className="text-sm text-emerald-700">Administrator</p><h1 className="mt-1 text-2xl font-semibold">Manajemen User dan Role</h1><p className="mt-2 text-sm text-zinc-600">Atur pengguna, role, dan menu yang dapat diakses. Profil pribadi selalu tersedia.</p></div><UserManagement users={users} roles={roles} /></div>;
}
