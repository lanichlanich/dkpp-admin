"use client";

import { useActionState } from "react";
import { registerAction } from "@/actions/auth";
import { FieldError, FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, {});
  return (
    <form action={action} className="space-y-4">
      <FormMessage status={state.status} message={state.message} />
      <div className="space-y-2">
        <Label htmlFor="name">Nama lengkap</Label>
        <Input id="name" name="name" autoComplete="name" placeholder="Nama lengkap Anda" className="h-11 bg-white" aria-invalid={Boolean(state.errors?.name)} />
        <FieldError messages={state.errors?.name} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="username">Username</Label><Input id="username" name="username" autoComplete="username" placeholder="namaanda" className="h-11 bg-white" aria-invalid={Boolean(state.errors?.username)} /><FieldError messages={state.errors?.username} /></div>
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" placeholder="nama@contoh.id" className="h-11 bg-white" aria-invalid={Boolean(state.errors?.email)} /><FieldError messages={state.errors?.email} /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="new-password" placeholder="Huruf dan angka" className="h-11 bg-white" aria-invalid={Boolean(state.errors?.password)} /><FieldError messages={state.errors?.password} /></div>
        <div className="space-y-2"><Label htmlFor="confirmPassword">Konfirmasi password</Label><Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Ulangi password" className="h-11 bg-white" aria-invalid={Boolean(state.errors?.confirmPassword)} /><FieldError messages={state.errors?.confirmPassword} /></div>
      </div>
      <p className="text-xs leading-5 text-zinc-500">Dengan mendaftar, Anda menyetujui penggunaan data akun untuk autentikasi aplikasi ini.</p>
      <SubmitButton>Buat akun dan lanjutkan</SubmitButton>
    </form>
  );
}
