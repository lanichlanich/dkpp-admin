"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/actions/profile";
import { FieldError, FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, {});
  return (
    <form action={action} className="space-y-5">
      <FormMessage status={state.status} message={state.message} />
      <div className="space-y-2"><Label htmlFor="currentPassword">Password saat ini</Label><Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" className="h-11" aria-invalid={Boolean(state.errors?.currentPassword)} /><FieldError messages={state.errors?.currentPassword} /></div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="newPassword">Password baru</Label><Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" placeholder="Minimal 8 karakter" className="h-11" aria-invalid={Boolean(state.errors?.newPassword)} /><FieldError messages={state.errors?.newPassword} /></div>
        <div className="space-y-2"><Label htmlFor="confirmPassword">Konfirmasi password baru</Label><Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" className="h-11" aria-invalid={Boolean(state.errors?.confirmPassword)} /><FieldError messages={state.errors?.confirmPassword} /></div>
      </div>
      <div className="max-w-48"><SubmitButton>Perbarui password</SubmitButton></div>
    </form>
  );
}
