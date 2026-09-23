"use server";

import { revalidatePath } from "next/cache";
import { database as db } from "@/lib/database";
import { requireUser } from "@/lib/session";

export async function markNotificationsReadAction() {
  const user = await requireUser();
  await db.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").run(
    new Date().toISOString(),
    user.id,
  );
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
