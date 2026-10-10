import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { database as db } from "@/lib/database";
import { isStorageConfigured, uploadStorageObject, deleteStorageObject } from "@/lib/storage";
import type { KakDraft, KakHistory, ReferencedKakDraft } from "@/lib/kak-types";
import type { KakOptions } from "@/lib/kak-validation";
import { readKakPoFile, kakBundleFileName } from "@/lib/kak-file-metadata";

const directory = path.join(process.cwd(), "data", "kak-documents");
export async function saveKak(input: { userId: string; draft: KakDraft; options: KakOptions; model: string; document: Buffer; poDocument: Buffer; poTemplateSha256: string; source: Buffer; sourceName: string }) {
  const id = randomUUID();
  const storageName = `${id}.docx`;
  const sourceStorageName = `${id}.pdf`;
  const slug = input.draft.metadata.subKegiatan.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "Sub-Kegiatan";
  const fileName = `Draft-KAK-${slug}-${input.draft.metadata.tahunAnggaran}.docx`;
  const poFileName = `Draft-PO-${slug}-${input.draft.metadata.tahunAnggaran}.docx`;
  const poDocument = { storageName: `${randomUUID()}.docx`, fileName: poFileName, fileSize: input.poDocument.length, templateSha256: input.poTemplateSha256 };
  const local = !isStorageConfigured();
  const completed: string[] = [];
  try {
    for (const [name, bytes, mime] of [[storageName, input.document, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], [poDocument.storageName, input.poDocument, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], [sourceStorageName, input.source, "application/pdf"]] as const) {
      if (local) { await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, name), bytes, { flag: "wx" }); }
      else await uploadStorageObject(name, bytes, mime);
      completed.push(name);
    }
    const m = input.draft.metadata;
    await db.prepare(`INSERT INTO kak_documents (id,user_id,tahun_anggaran,sub_kegiatan,kode_sub_kegiatan,pagu_anggaran,source_name,source_storage_name,source_file_size,file_name,storage_name,file_size,draft_json,model,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, input.userId, m.tahunAnggaran, m.subKegiatan, m.kodeSubKegiatan, m.paguAnggaran,
      path.basename(input.sourceName).slice(0, 250), sourceStorageName, input.source.length, fileName, storageName, input.document.length,
      JSON.stringify({ ...input.draft, options: input.options, poDocument }), input.model, new Date().toISOString());
  } catch (error) {
    await Promise.allSettled(completed.map((name) => local ? rm(path.join(directory, name), { force: true }) : deleteStorageObject(name)));
    throw error;
  }
  return { id, fileName, poFileName, bundleFileName: kakBundleFileName(fileName) };
}
export async function getKakHistory(): Promise<KakHistory[]> {
  const rows = await db.prepare(`SELECT d.*, u.name AS created_by FROM kak_documents d JOIN users u ON u.id=d.user_id ORDER BY d.created_at DESC LIMIT 100`).all() as Array<Record<string, string | number>>;
  return rows.map((r) => {
    const draft = JSON.parse(String(r.draft_json)) as Partial<ReferencedKakDraft> & { options?: KakOptions };
    const po = readKakPoFile(draft);
    return { id: String(r.id), tahunAnggaran: Number(r.tahun_anggaran), subKegiatan: String(r.sub_kegiatan), kodeSubKegiatan: String(r.kode_sub_kegiatan), paguAnggaran: String(r.pagu_anggaran), fileName: String(r.file_name), sourceName: String(r.source_name), createdAt: String(r.created_at), createdBy: String(r.created_by), warnings: draft.warnings || [], references: draft.references || [], nomorUrutSubKegiatan: draft.options?.nomorUrutSubKegiatan, nomorUrutReference: draft.options?.nomorUrutReference, poFileName: po?.fileName, bundleFileName: po ? kakBundleFileName(String(r.file_name)) : undefined };
  });
}
export async function getKakDownload(id: string, source: boolean | "po") {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = await db.prepare("SELECT file_name,storage_name,source_name,source_storage_name,draft_json FROM kak_documents WHERE id=?").get(id) as Record<string, string> | undefined;
  if (!row) return null;
  const po = source === "po" ? readKakPoFile(row.draft_json) : undefined;
  if (source === "po" && !po) return null;
  const storageName = source === "po" ? po!.storageName : source ? row.source_storage_name : row.storage_name;
  if (!/^[0-9a-f-]{36}\.(?:docx|pdf)$/i.test(storageName)) return null;
  return { storageName, fileName: source === "po" ? po!.fileName : source ? row.source_name : row.file_name, filePath: path.join(directory, storageName) };
}
