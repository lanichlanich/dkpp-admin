import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { generateKakDraft } from "@/lib/gemini-kak";
import { GeminiApiError } from "@/lib/gemini-client";
import { generateKakDocument } from "@/lib/kak-document";
import { generatePoDocument, getPoWarnings } from "@/lib/po-document";
import { kakOptionsSchema } from "@/lib/kak-validation";
import { resolveKakSequence } from "@/lib/kak-sequence";
import { saveKak } from "@/lib/kak";
import { getPptkEmployeeOptions } from "@/lib/employees";
import { MAX_MULTIPART_REQUEST_SIZE_BYTES } from "@/lib/upload-limits";

export const runtime = "nodejs";
export const maxDuration = 300;
const active = new Set<string>();
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  if (Number(request.headers.get("content-length")) > MAX_MULTIPART_REQUEST_SIZE_BYTES) return NextResponse.json({ error: "Ukuran upload maksimal 2 MB." }, { status: 413 });
  if (active.has(user.id)) return NextResponse.json({ error: "Pembuatan PO dan KAK masih berlangsung. Tunggu sampai selesai." }, { status: 429 });
  active.add(user.id);
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Unggah RKA dalam format PDF." }, { status: 400 });
    let options;
    try { options = kakOptionsSchema.safeParse(JSON.parse(String(form.get("options") || "{}"))); }
    catch { return NextResponse.json({ error: "Data form tidak valid." }, { status: 400 }); }
    if (!options.success) return NextResponse.json({ error: options.error.issues[0]?.message || "Periksa form." }, { status: 400 });
    if (options.data.pptkNip) {
      const employee = (await getPptkEmployeeOptions()).find((candidate) => candidate.nip === options.data.pptkNip);
      if (!employee || employee.name !== options.data.pptkNama) return NextResponse.json({ error: "PPTK harus dipilih dari daftar pegawai aktif." }, { status: 400 });
    }
    const result = await generateKakDraft(file, options.data);
    if (!options.data.pptkNama) result.draft.warnings.push("Nama dan NIP PPTK belum diisi; lengkapi pada draft sebelum digunakan.");
    const sequence = await resolveKakSequence(result.draft.metadata, options.data.nomorUrutSubKegiatan);
    if (sequence.warning) result.draft.warnings.push(sequence.warning);
    const resolvedOptions = { ...options.data, nomorUrutSubKegiatan: sequence.number, nomorUrutReference: sequence.reference };
    result.draft.warnings.push(...getPoWarnings(result.draft, resolvedOptions));
    const [document, po] = await Promise.all([generateKakDocument(result.draft, resolvedOptions), generatePoDocument(result.draft, resolvedOptions)]);
    const saved = await saveKak({ userId: user.id, ...result, document, poDocument: po.document, poTemplateSha256: po.templateSha256, options: resolvedOptions, sourceName: file.name });
    return NextResponse.json({ ...saved, metadata: result.draft.metadata, warnings: result.draft.warnings, references: result.draft.references, nomorUrutSubKegiatan: sequence.number, nomorUrutReference: sequence.reference }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof GeminiApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("PO and KAK generation failed", error);
    return NextResponse.json({ error: "Draft PO dan KAK gagal dibuat atau disimpan. Silakan coba lagi." }, { status: 500 });
  } finally { active.delete(user.id); }
}
