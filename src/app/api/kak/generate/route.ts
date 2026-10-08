import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { generateKakDraft } from "@/lib/gemini-kak";
import { GeminiApiError } from "@/lib/gemini-client";
import { generateKakDocument } from "@/lib/kak-document";
import { kakOptionsSchema } from "@/lib/kak-validation";
import { saveKak } from "@/lib/kak";
import { MAX_MULTIPART_REQUEST_SIZE_BYTES } from "@/lib/upload-limits";

export const runtime = "nodejs";
export const maxDuration = 180;
const active = new Set<string>();
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  if (Number(request.headers.get("content-length")) > MAX_MULTIPART_REQUEST_SIZE_BYTES) return NextResponse.json({ error: "Ukuran upload maksimal 2 MB." }, { status: 413 });
  if (active.has(user.id)) return NextResponse.json({ error: "Pembuatan KAK masih berlangsung. Tunggu sampai selesai." }, { status: 429 });
  active.add(user.id);
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Unggah RKA dalam format PDF." }, { status: 400 });
    let options;
    try { options = kakOptionsSchema.safeParse(JSON.parse(String(form.get("options") || "{}"))); }
    catch { return NextResponse.json({ error: "Data form tidak valid." }, { status: 400 }); }
    if (!options.success) return NextResponse.json({ error: options.error.issues[0]?.message || "Periksa form." }, { status: 400 });
    const result = await generateKakDraft(file);
    if (!options.data.pptkNama) result.draft.warnings.push("Nama dan NIP PPTK belum diisi; lengkapi pada draft sebelum digunakan.");
    const document = await generateKakDocument(result.draft, options.data);
    const saved = await saveKak({ userId: user.id, ...result, document, options: options.data, sourceName: file.name });
    return NextResponse.json({ ...saved, metadata: result.draft.metadata, warnings: result.draft.warnings }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof GeminiApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("KAK generation failed", error);
    return NextResponse.json({ error: "Draft KAK gagal dibuat atau disimpan. Silakan coba lagi." }, { status: 500 });
  } finally { active.delete(user.id); }
}
