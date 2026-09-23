"use server";

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";
import { passwordSchema, profileSchema, type ActionState } from "@/lib/validation";

export async function updateProfileAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const conflict = await db
    .prepare(
      "SELECT email, username FROM users WHERE id != ? AND (lower(email) = lower(?) OR lower(username) = lower(?))",
    )
    .get(user.id, parsed.data.email, parsed.data.username) as
    | { email: string; username: string }
    | undefined;

  if (conflict) {
    return {
      status: "error",
      message:
        conflict.email.toLowerCase() === parsed.data.email.toLowerCase()
          ? "Email sudah digunakan akun lain."
          : "Username sudah digunakan akun lain.",
    };
  }

  await db.prepare(
    "UPDATE users SET name = ?, username = ?, email = ?, updated_at = ? WHERE id = ?",
  ).run(
    parsed.data.name,
    parsed.data.username,
    parsed.data.email.toLowerCase(),
    new Date().toISOString(),
    user.id,
  );

  revalidatePath("/dashboard", "layout");
  return { status: "success", message: "Profil berhasil diperbarui." };
}

export async function updatePasswordAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const row = await db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as
    | { password_hash: string }
    | undefined;

  if (!row || !(await compare(parsed.data.currentPassword, row.password_hash))) {
    return { status: "error", message: "Password saat ini tidak sesuai." };
  }

  const passwordHash = await hash(parsed.data.newPassword, 12);
  await db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
    passwordHash,
    new Date().toISOString(),
    user.id,
  );

  return { status: "success", message: "Password berhasil diperbarui." };
}
