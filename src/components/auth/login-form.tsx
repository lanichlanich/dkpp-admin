"use client";

import { useActionState } from "react";
import { loginAction } from "@/actions/auth";
import { FieldError, FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-5">
      <FormMessage status={state.status} message={state.message} />
      <div className="space-y-2">
        <Label htmlFor="identity">Email atau username</Label>
        <Input id="identity" name="identity" autoComplete="username" placeholder="nama@contoh.id" className="h-11 bg-white" aria-invalid={Boolean(state.errors?.identity)} />
        <FieldError messages={state.errors?.identity} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between"><Label htmlFor="password">Password</Label><span className="text-xs text-zinc-400">Minimal 8 karakter</span></div>
        <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="Masukkan password" className="h-11 bg-white" aria-invalid={Boolean(state.errors?.password)} />
        <FieldError messages={state.errors?.password} />
      </div>
      <SubmitButton>Masuk ke dashboard</SubmitButton>
    </form>
  );
}
