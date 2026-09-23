"use server";

import { randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { database as db } from "@/lib/database";
import { createNotification } from "@/lib/notifications";
import { createSession, deleteSession } from "@/lib/session";
import { loginSchema, registerSchema, type ActionState } from "@/lib/validation";

export async function registerAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const { name, username, email, password } = parsed.data;
  const existing = await db
    .prepare("SELECT email, username FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?)")
    .get(email, username) as { email: string; username: string } | undefined;

  if (existing) {
    return {
      status: "error",
      message:
        existing.email.toLowerCase() === email.toLowerCase()
          ? "Email sudah terdaftar. Silakan masuk."
          : "Username sudah digunakan. Pilih username lain.",
    };
  }

  const userId = randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hash(password, 12);

  try {
    await db.prepare(
      `INSERT INTO users (id, name, username, email, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(userId, name, username, email.toLowerCase(), passwordHash, now, now);
  } catch {
    return { status: "error", message: "Akun tidak dapat dibuat. Silakan coba lagi." };
  }

  await createSession(userId);
  await createNotification(userId, "info", "Akun berhasil dibuat", "Selamat datang. Akun administrator Anda siap digunakan.");
  redirect("/dashboard");
}

export async function loginAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    identity: formData.get("identity"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  let user: { id: string; password_hash: string } | undefined;
  try {
    user = await db
      .prepare(
        "SELECT id, password_hash FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?) LIMIT 1",
      )
      .get(parsed.data.identity, parsed.data.identity) as
      | { id: string; password_hash: string }
      | undefined;
  } catch {
    return {
      status: "error",
      message: "Login sementara tidak tersedia karena koneksi database belum tersambung.",
    };
  }

  if (!user || !(await compare(parsed.data.password, user.password_hash))) {
    return { status: "error", message: "Email/username atau password tidak sesuai." };
  }

  try {
    await createSession(user.id);
  } catch {
    return {
      status: "error",
      message: "Sesi login tidak dapat dibuat. Silakan coba lagi.",
    };
  }
  redirect("/dashboard");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
