"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Pencil, Plus, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { createUserAction, deleteRoleAction, editUserAction, saveRoleAction, saveUserAccessAction, type ManagementState } from "@/actions/user-management";
import { MENU_CATALOG } from "@/lib/access-control";
import type { ManagedRole, ManagedUser } from "@/lib/user-management";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending && <LoaderCircle className="size-4 animate-spin" />}{pending ? "Menyimpan..." : children}</Button>;
}
function useResult(state: ManagementState, setOpen: React.Dispatch<React.SetStateAction<boolean>>) {
  const router = useRouter();
  useEffect(() => {
    if (!state.submittedAt) return;
    if (state.status === "success") { toast.success(state.message); setOpen(false); router.refresh(); }
    else toast.error(state.message);
  }, [state, setOpen, router]);
}
function MenuChoices({ menus, prefix }: { menus: string[]; prefix: string }) {
  return <div className="space-y-4">{[...new Set(MENU_CATALOG.map(menu => menu.group))].map(group => <fieldset key={group} className="rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">{group}</legend><div className="grid gap-2 sm:grid-cols-2">{MENU_CATALOG.filter(menu => menu.group === group).map(menu => <label key={menu.id} htmlFor={`${prefix}-${menu.id}`} className="flex items-start gap-2 text-sm"><input id={`${prefix}-${menu.id}`} type="checkbox" name="menus" value={menu.id} defaultChecked={menus.includes(menu.id)} className="mt-0.5 accent-emerald-600" />{menu.label}</label>)}</div></fieldset>)}</div>;
}
function RoleDialog({ role }: { role?: ManagedRole }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveRoleAction, {});
  const [deleteState, deleteAction] = useActionState(deleteRoleAction, {});
  useResult(state, setOpen); useResult(deleteState, setOpen);
  return <><Button variant="outline" disabled={role?.id === "administrator" || role?.id === "unassigned"} onClick={() => setOpen(true)}>{role ? "Edit akses role" : <><Plus className="size-4" />Tambah role</>}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{role ? `Edit role ${role.name}` : "Tambah role"}</DialogTitle><DialogDescription>Pilihan menu berlaku untuk semua pengguna yang mengikuti role ini.</DialogDescription></DialogHeader><form action={action} className="min-w-0 space-y-4"><input type="hidden" name="id" value={role?.id ?? ""} /><Label htmlFor="role-name">Nama role</Label><Input id="role-name" name="name" defaultValue={role?.name} maxLength={80} required /><MenuChoices menus={role?.menus ?? []} prefix="role" /><Submit>Simpan role</Submit></form>{role && !["administrator", "perencana", "unassigned"].includes(role.id) && <form action={deleteAction}><input type="hidden" name="id" value={role.id} /><Submit>Hapus role yang tidak digunakan</Submit></form>}</DialogContent></Dialog></>;
}
function UserAccessDialog({ user, roles }: { user: ManagedUser; roles: ManagedRole[] }) {
  const [open, setOpen] = useState(false);
  const [roleId, setRoleId] = useState(user.roleId);
  const [custom, setCustom] = useState(user.menus !== null);
  const [state, action] = useActionState(saveUserAccessAction, {});
  useResult(state, setOpen);
  const role = roles.find(role => role.id === roleId);
  return <><Button variant="outline" onClick={() => { setRoleId(user.roleId); setCustom(user.menus !== null); setOpen(true); }}><UserCog className="size-4" />Atur akses</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Akses {user.name}</DialogTitle><DialogDescription>{user.email} · Pengaturan langsung berlaku untuk sesi pengguna yang sedang aktif.</DialogDescription></DialogHeader><form action={action} className="min-w-0 space-y-4"><input name="id" type="hidden" value={user.id} /><div className="space-y-2"><Label htmlFor="user-role">Role</Label><select id="user-role" name="roleId" value={roleId} onChange={event => setRoleId(event.target.value)} className="h-10 w-full rounded-md border bg-white px-3">{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={user.active} />Akun aktif</label>{user.protectedAdministrator && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Administrator utama dilindungi. Role Administrator dan status aktif wajib dipertahankan.</p>}{role?.isAdministrator ? <p className="text-sm text-zinc-600">Administrator dapat mengakses seluruh menu dan manajemen pengguna.</p> : <><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="customMenus" checked={custom} onChange={event => setCustom(event.target.checked)} />Gunakan menu khusus untuk pengguna ini</label>{custom ? <MenuChoices key={roleId} menus={user.menus ?? role?.menus ?? []} prefix="user" /> : <p className="text-sm text-zinc-600">Mengikuti akses role: {role?.menus.map(id => MENU_CATALOG.find(menu => menu.id === id)?.label).join(", ") || "Belum ada menu"}.</p>}</>}<Submit>Simpan akses pengguna</Submit></form></DialogContent></Dialog></>;
}
function CreateUserDialog({ roles }: { roles: ManagedRole[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createUserAction, {});
  useResult(state, setOpen);
  return <><Button onClick={() => setOpen(true)}><Plus className="size-4" />Tambah pengguna</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Tambah pengguna</DialogTitle><DialogDescription>Gunakan password minimal 8 karakter dengan huruf dan angka.</DialogDescription></DialogHeader><form action={action} className="min-w-0 space-y-3">{[["name", "Nama", "text"], ["username", "Username", "text"], ["email", "Email", "email"], ["password", "Password", "password"], ["confirmPassword", "Konfirmasi password", "password"]].map(([name, label, type]) => <div key={name} className="space-y-1"><Label htmlFor={`new-${name}`}>{label}</Label><Input id={`new-${name}`} name={name} type={type} required autoComplete={type === "password" ? "new-password" : "off"} /></div>)}<Label htmlFor="new-role">Role</Label><select id="new-role" name="roleId" defaultValue="unassigned" className="h-10 w-full rounded-md border bg-white px-3">{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select><Submit>Tambah pengguna</Submit></form></DialogContent></Dialog></>;
}
function EditUserDialog({ user }: { user: ManagedUser }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(editUserAction, {});
  useResult(state, setOpen);
  return <>
    <Button variant="outline" onClick={() => setOpen(true)} aria-label={`Edit user ${user.name}`}><Pencil className="size-4" />Edit user</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit user {user.name}</DialogTitle><DialogDescription>Perbarui identitas pengguna. Email dan username digunakan untuk login.</DialogDescription></DialogHeader>
        <form action={action} className="min-w-0 space-y-4">
          <input type="hidden" name="id" value={user.id} />
          {[["name", "Nama", "text", user.name, 100], ["username", "Username", "text", user.username, 32], ["email", "Email", "email", user.email, 160]].map(([name, label, type, value, limit]) => <div key={String(name)} className="space-y-1">
            <Label htmlFor={`edit-${user.id}-${name}`}>{label}</Label>
            <Input id={`edit-${user.id}-${name}`} name={String(name)} type={String(type)} defaultValue={String(value)} maxLength={Number(limit)} readOnly={name === "email" && user.protectedAdministrator} required autoComplete="off" />
          </div>)}
          {user.protectedAdministrator && <p className="text-sm text-zinc-600">Email administrator utama dilindungi dan tidak dapat diubah.</p>}
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><Submit>Simpan perubahan</Submit></div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
export function UserManagement({ users, roles }: { users: ManagedUser[]; roles: ManagedRole[] }) {
  const [query, setQuery] = useState("");
  const visible = users.filter(user => `${user.name} ${user.username} ${user.email}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-8"><section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Pengguna ({users.length})</h2><CreateUserDialog roles={roles} /></div><Input placeholder="Cari nama, username, atau email..." value={query} onChange={event => setQuery(event.target.value)} className="max-w-sm" /><div className="divide-y overflow-hidden rounded-xl border bg-white">{visible.map(user => <div key={user.id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div><p className="font-medium">{user.name}{user.protectedAdministrator && <ShieldCheck className="ml-2 inline size-4 text-emerald-600" />}</p><p className="text-sm text-zinc-500">{user.email} · @{user.username}</p><p className="mt-1 text-sm">{roles.find(role => role.id === user.roleId)?.name} · {user.active ? "Aktif" : "Nonaktif"}{user.menus !== null && " · Menu khusus"}</p></div><div className="flex flex-wrap gap-2"><EditUserDialog user={user} /><UserAccessDialog user={user} roles={roles} /></div></div>)}{!visible.length && <p className="p-4 text-sm text-zinc-500">Pengguna tidak ditemukan.</p>}</div></section><section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Role dan akses menu</h2><RoleDialog /></div><div className="grid gap-4 md:grid-cols-2">{roles.map(role => <div key={role.id} className="space-y-3 rounded-xl border bg-white p-4"><h3 className="font-semibold">{role.name}</h3><p className="text-sm text-zinc-600">{role.isAdministrator ? "Seluruh menu dan manajemen pengguna" : role.menus.map(id => MENU_CATALOG.find(menu => menu.id === id)?.label).join(", ") || "Profil pribadi saja"}</p><RoleDialog role={role} /></div>)}</div></section></div>;
}
