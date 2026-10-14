import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { mapPublicUser, type PublicUser } from "@/lib/db-types";
import { database as db } from "@/lib/database";

const SESSION_COOKIE = "admin_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now.toISOString());
  await db.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(tokenHash, userId, expiresAt.toISOString(), now.toISOString());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  }

  cookieStore.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await db
    .prepare(
      `SELECT users.id, users.name, users.username, users.email, users.created_at,
        users.role_id, users.menu_permissions, users.protected_administrator,
        app_roles.name AS role_name, app_roles.is_administrator, app_roles.menu_permissions AS role_permissions
       FROM sessions
       INNER JOIN users ON users.id = sessions.user_id
       INNER JOIN app_roles ON app_roles.id = users.role_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.is_active = 1`,
    )
    .get(hashToken(token), new Date().toISOString()) as
    | {
        id: string;
        name: string;
        username: string;
        email: string;
        created_at: string;
        role_id: string;
        role_name: string;
        is_administrator: number;
        protected_administrator: number;
        menu_permissions: string | null;
        role_permissions: string;
      }
    | undefined;

  return row ? mapPublicUser(row) : null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
