import Link from "next/link";
import { requireUser } from "@/lib/session";
import { landingPath } from "@/lib/access-control";
import { redirect } from "next/navigation";
export default async function AccessPage() {
  const user = await requireUser();
  const target = landingPath(user);
  if (target !== "/dashboard/akses") redirect(target);
  return <div className="mx-auto max-w-xl rounded-xl border bg-white p-6"><h1 className="text-xl font-semibold">Akses menu belum ditetapkan</h1><p className="mt-3 text-zinc-600">Akun Anda sudah terdaftar. Hubungi administrator untuk menentukan role dan menu yang dapat diakses.</p><Link className="mt-5 inline-block text-emerald-700 underline" href="/dashboard/profile">Buka profil saya</Link></div>;
}
