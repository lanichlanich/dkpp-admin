import "server-only";

import { randomUUID } from "node:crypto";
import { cache } from "react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export type NotificationType = "success" | "warning" | "error" | "info";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  readAt: string | null;
  createdAt: string;
};

export function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  description: string,
) {
  db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), userId, type, title, description, new Date().toISOString());
}

export const getNotificationCenter = cache(async () => {
  const user = await requireUser();
  const rows = db
    .prepare(
      `SELECT id, type, title, description, read_at, created_at
       FROM notifications WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 12`,
    )
    .all(user.id) as Array<{
      id: string;
      type: NotificationType;
      title: string;
      description: string;
      read_at: string | null;
      created_at: string;
    }>;

  const unreadCount = (
    db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL").get(user.id) as { count: number }
  ).count;

  return {
    unreadCount,
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
  };
});
