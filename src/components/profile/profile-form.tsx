"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/actions/profile";
import { FieldError, FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicUser } from "@/lib/db";

export function ProfileForm({ user }: { user: PublicUser }) {
  const [state, action] = useActionState(updateProfileAction, {});
  return (
    <form action={action} className="space-y-5">
      <FormMessage status={state.status} message={state.message} />
      <div className="space-y-2"><Label htmlFor="name">Nama lengkap</Label><Input id="name" name="name" defaultValue={user.name} autoComplete="name" className="h-11" aria-invalid={Boolean(state.errors?.name)} /><FieldError messages={state.errors?.name} /></div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="username">Username</Label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">@</span><Input id="username" name="username" defaultValue={user.username} autoComplete="username" className="h-11 pl-7" aria-invalid={Boolean(state.errors?.username)} /></div><FieldError messages={state.errors?.username} /></div>
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={user.email} autoComplete="email" className="h-11" aria-invalid={Boolean(state.errors?.email)} /><FieldError messages={state.errors?.email} /></div>
      </div>
      <div className="max-w-48"><SubmitButton>Simpan perubahan</SubmitButton></div>
    </form>
  );
}
