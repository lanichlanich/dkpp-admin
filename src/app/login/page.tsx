import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, ShieldCheck, Sparkles } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="grid min-h-screen bg-zinc-950 lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden border-r border-white/10 px-12 py-10 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(79,70,229,0.34),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,0.18),transparent_30%)]" />
        <div className="relative flex items-center gap-3 font-semibold">
          <span className="grid size-10 place-items-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/30"><BarChart3 className="size-5" /></span>
          <span className="text-lg">AdminFlow</span>
        </div>
        <div className="relative my-auto max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-300"><Sparkles className="size-4 text-indigo-300" />Ruang kerja admin yang lebih teratur</div>
          <h1 className="text-5xl font-semibold tracking-[-0.04em] text-balance">Semua yang penting, dalam satu dashboard.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-zinc-400">Pantau aktivitas akun, kelola profil, dan jaga keamanan akses dari antarmuka yang bersih dan mudah digunakan.</p>
          <div className="mt-10 flex items-center gap-3 text-sm text-zinc-400"><ShieldCheck className="size-5 text-emerald-400" />Password terenkripsi dan sesi aman berbasis database</div>
        </div>
        <p className="relative text-sm text-zinc-600">© 2026 AdminFlow</p>
      </section>
      <section className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-10 flex items-center gap-3 font-semibold text-zinc-950 lg:hidden"><span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white"><BarChart3 className="size-4" /></span>AdminFlow</Link>
          <div className="mb-8">
            <p className="mb-2 text-sm font-medium text-indigo-600">Selamat datang kembali</p>
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">Masuk ke akun Anda</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-500">Gunakan email atau username yang sudah terdaftar.</p>
          </div>
          <LoginForm />
          <p className="mt-7 text-center text-sm text-zinc-500">Belum memiliki akun?{" "}<Link href="/register" className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700">Daftar sekarang <ArrowRight className="size-3.5" /></Link></p>
        </div>
      </section>
    </main>
  );
}
