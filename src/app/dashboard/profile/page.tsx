import type { Metadata } from "next";
import { CalendarDays, KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordForm } from "@/components/profile/password-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Profil Saya" };

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default async function ProfilePage() {
  const user = await requireUser();
  const joinedAt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(user.createdAt));

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div><p className="text-sm font-medium text-indigo-600">Pengaturan akun</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Profil Saya</h1><p className="mt-2 text-sm text-zinc-500">Kelola informasi pribadi dan keamanan akses akun Anda.</p></div>

      <Card className="overflow-hidden border-zinc-200/80 shadow-sm">
        <div className="h-28 bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.95),transparent_35%),linear-gradient(120deg,#18181b,#27272a)]" />
        <CardContent className="relative flex flex-col gap-4 px-6 pb-6 pt-0 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Avatar className="-mt-10 size-24 border-4 border-white shadow-sm"><AvatarFallback className="bg-indigo-100 text-2xl font-semibold text-indigo-700">{initials(user.name)}</AvatarFallback></Avatar>
            <div className="pb-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold text-zinc-950">{user.name}</h2><Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50"><ShieldCheck className="size-3" />Aktif</Badge></div><p className="mt-1 text-sm text-zinc-500">@{user.username}</p></div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pb-1 text-xs text-zinc-500"><span className="flex items-center gap-1.5"><Mail className="size-3.5" />{user.email}</span><span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />Bergabung {joinedAt}</span></div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <Card className="border-zinc-200/80 shadow-sm">
            <CardHeader><div className="mb-1 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><UserRound className="size-4.5" /></span><div><CardTitle>Informasi pribadi</CardTitle><CardDescription>Informasi ini digunakan di seluruh dashboard.</CardDescription></div></div></CardHeader>
            <CardContent><ProfileForm user={user} /></CardContent>
          </Card>
          <Card id="security" className="scroll-mt-24 border-zinc-200/80 shadow-sm">
            <CardHeader><div className="mb-1 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-amber-50 text-amber-600"><KeyRound className="size-4.5" /></span><div><CardTitle>Ubah password</CardTitle><CardDescription>Gunakan kombinasi minimal 8 karakter berisi huruf dan angka.</CardDescription></div></div></CardHeader>
            <CardContent><PasswordForm /></CardContent>
          </Card>
        </div>
        <aside className="space-y-5">
          <Card className="border-zinc-200/80 shadow-sm"><CardHeader><CardTitle className="text-base">Tips keamanan</CardTitle></CardHeader><CardContent className="space-y-4 text-sm leading-6 text-zinc-500"><p>Gunakan password unik yang tidak digunakan pada layanan lain.</p><p>Keluar dari akun setelah menggunakan perangkat bersama.</p><p>Perbarui password segera jika Anda melihat aktivitas mencurigakan.</p></CardContent></Card>
          <Card className="border-0 bg-indigo-600 text-white shadow-sm"><CardContent className="p-5"><ShieldCheck className="size-7 text-indigo-200" /><p className="mt-4 font-medium">Akun Anda terlindungi</p><p className="mt-2 text-xs leading-5 text-indigo-100">Password disimpan dalam bentuk hash dan token sesi tidak pernah disimpan sebagai teks biasa di database.</p></CardContent></Card>
        </aside>
      </div>
    </div>
  );
}
