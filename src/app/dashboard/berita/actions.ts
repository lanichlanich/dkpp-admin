"use server";

import { revalidatePath } from "next/cache";
import { canAccessMenu } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/session";
import { saveNews } from "@/lib/news";

export async function saveNewsAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessMenu(user, "berita")) return { ok: false as const, message: "Anda tidak memiliki akses redaksi." };
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  const status = text("status");
  if (status !== "draft" && status !== "published") return { ok: false as const, message: "Status berita tidak valid." };
  let saved;
  try {
    saved = await saveNews({ id: text("id") || undefined, revision: Number(text("revision")), title: text("title"), summary: text("summary"), category: text("category"), coverUrl: text("coverUrl"), bodyHtml: text("bodyHtml"), status });
  } catch (error) {
    const message = error instanceof Error && error.name === "NewsValidationError" ? error.message : "Berita belum berhasil disimpan. Periksa data yang dimasukkan.";
    return { ok: false as const, message };
  }
  revalidatePath("/");
  revalidatePath("/berita");
  revalidatePath("/berita/[slug]", "page");
  revalidatePath("/dashboard/berita");
  return { ok: true as const, id: saved.id, message: status === "published" ? "Berita diterbitkan." : "Draf disimpan." };
}
