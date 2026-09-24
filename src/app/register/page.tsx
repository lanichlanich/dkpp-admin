import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Daftar" };
const benefits = ["Dashboard ringkas dan responsif", "Pengelolaan profil mandiri", "Sesi aman tersimpan di SQLite"];

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="grid min-h-screen bg-zinc-50 lg:grid-cols-[0.92fr_1.08fr]">
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-lg">
          <Link href="/login" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-950"><ArrowLeft className="size-4" />Kembali ke halaman masuk</Link>
          <div className="mb-7">
            <p className="mb-2 text-sm font-medium text-indigo-600">Mulai sekarang</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Buat akun administrator</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-500">Lengkapi informasi berikut untuk membuat ruang kerja Anda.</p>
          </div>
          <RegisterForm />
        </div>
      </section>
      <section className="relative hidden overflow-hidden bg-indigo-600 px-14 py-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_5%,rgba(255,255,255,0.22),transparent_30%),linear-gradient(145deg,transparent_35%,rgba(15,23,42,0.22))]" />
        <div className="relative flex items-center gap-3 font-semibold"><span className="grid size-10 place-items-center rounded-xl bg-white p-1 ring-1 ring-white/20"><Image src="/dkpp-admin-logo.png" alt="" width={36} height={36} className="size-8 object-contain" priority /></span><span className="text-lg">DKPP-Admin</span></div>
        <div className="relative my-auto max-w-lg">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-indigo-200">Dibuat untuk fokus</p>
          <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.035em]">Mulai kelola pekerjaan dengan lebih tenang.</h2>
          <div className="mt-10 space-y-5">{benefits.map((benefit) => <div key={benefit} className="flex items-center gap-3 text-indigo-50"><CheckCircle2 className="size-5 text-indigo-200" /><span>{benefit}</span></div>)}</div>
        </div>
      </section>
    </main>
  );
}
