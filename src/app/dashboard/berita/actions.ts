"use server";

import { revalidatePath } from "next/cache";
import { canAccessMenu } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/session";
import { saveNews, deleteNews, deleteNewsTerm, saveNewsTerm } from "@/lib/news";

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
    saved = await saveNews({ id: text("id") || undefined, revision: Number(text("revision")), title: text("title"), summary: text("summary"), category: "Umum", categoryId: text("categoryId") || "default", tagIds: form.getAll("tagIds").filter((value): value is string => typeof value === "string"), coverUrl: text("coverUrl"), bodyHtml: text("bodyHtml"), status });
  } catch (error) {
    const message = error instanceof Error && error.name === "NewsValidationError" ? error.message : "Berita belum berhasil disimpan. Periksa data yang dimasukkan.";
    return { ok: false as const, message };
  }
  refreshNews();
  return { ok: true as const, id: saved.id, message: status === "published" ? "Berita diterbitkan." : "Draf disimpan." };
}

function refreshNews() {
  revalidatePath("/");
  revalidatePath("/berita");
  revalidatePath("/berita/[slug]", "page");
  for (const route of ["buat", "daftar", "kategori", "tag"]) revalidatePath(`/dashboard/berita/${route}`);
}

export async function manageNewsAction(_previous: { ok: boolean; message: string }, form: FormData) {
  const text = (key: string) => String(form.get(key) ?? "");
  try {
    if (text("operation") === "deleteArticle") await deleteNews(text("id"), Number(text("revision")));
    else {
      const kind = text("kind");
      if (kind !== "category" && kind !== "tag") return { ok: false, message: "Jenis data tidak valid." };
      if (text("operation") === "deleteTerm") await deleteNewsTerm(kind, text("id"));
      else if (text("operation") === "saveTerm") await saveNewsTerm(kind, text("name"), text("id") || undefined, text("previousName"));
      else return { ok: false, message: "Tindakan tidak valid." };
    }
    refreshNews();
    return { ok: true, message: "Perubahan berhasil." };
  } catch (error) {
    return { ok: false, message: error instanceof Error && ["NewsValidationError", "NewsAccessError"].includes(error.name) ? error.message : "Perubahan gagal disimpan." };
  }
}
