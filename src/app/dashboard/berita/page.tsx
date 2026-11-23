import { redirect } from "next/navigation";
import { requireMenuAccess } from "@/lib/authorization";

export default async function NewsIndex({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireMenuAccess("berita");
  const { edit } = await searchParams;
  redirect(typeof edit === "string" && edit ? `/dashboard/berita/buat?edit=${encodeURIComponent(edit)}` : "/dashboard/berita/daftar");
}
