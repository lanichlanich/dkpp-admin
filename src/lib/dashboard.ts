import "server-only";

import { mapPublicUser, type PublicUser } from "@/lib/db-types";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";

export async function getDashboardData() {
  await requireUser();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const totalUsers = (await db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count;
  const activeSessions = (await db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE expires_at > ?").get(now.toISOString()) as { count: number }).count;
  const newToday = (await db.prepare("SELECT COUNT(*) AS count FROM users WHERE created_at >= ?").get(today) as { count: number }).count;
  const recentRows = await db.prepare("SELECT id, name, username, email, created_at FROM users ORDER BY created_at DESC LIMIT 5").all() as Array<{ id: string; name: string; username: string; email: string; created_at: string }>;
  return { totalUsers, activeSessions, newToday, recentUsers: recentRows.map(mapPublicUser) };
}

export function profileCompletion(user: PublicUser) {
  return [user.name, user.username, user.email].filter(Boolean).length / 3 * 100;
}
