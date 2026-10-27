import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { deleteStorageObject, downloadStorageObject, isStorageConfigured, uploadStorageObject } from "@/lib/storage";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

const directory = path.join(process.cwd(), "data", "plt-documents");
const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|doc|docx)$/i;
const mimeTypes = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
export type PltDocument = { fileName: string; storageName: string; fileSize: number; mimeType: string };
export class PltFileError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function storePltFile(file: File): Promise<PltDocument> {
  if (!file.size) throw new PltFileError("File SK Plt. tidak boleh kosong.");
  if (file.size > MAX_UPLOAD_SIZE_BYTES) throw new PltFileError(`Ukuran SK Plt. maksimal ${MAX_UPLOAD_SIZE_MB} MB.`, 413);
  const extension = /\.(pdf|doc|docx)$/i.exec(file.name)?.[1].toLowerCase() as keyof typeof mimeTypes | undefined;
  if (!extension) throw new PltFileError("Format SK Plt. harus PDF, DOC, atau DOCX.");
  const bytes = Buffer.from(await file.arrayBuffer());
  let valid = extension === "pdf" ? bytes.subarray(0, 5).toString() === "%PDF-" : extension === "doc" ? bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) : false;
  if (extension === "docx") {
    try { const zip = new PizZip(bytes); valid = Boolean(zip.file("[Content_Types].xml") && zip.file("word/document.xml")); } catch { valid = false; }
  }
  if (!valid) throw new PltFileError("Isi file SK tidak sesuai dengan format yang dipilih.");
  const document = {
    fileName: (file.name.split(/[\\/]/).pop() ?? `SK-Plt.${extension}`).replace(/[\x00-\x1f\x7f<>:"|?*]/g, "_").slice(-180),
    storageName: `${randomUUID()}.${extension}`, fileSize: bytes.length, mimeType: mimeTypes[extension],
  };
  try {
    if (isStorageConfigured()) await uploadStorageObject(document.storageName, bytes, document.mimeType);
    else { await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, document.storageName), bytes, { flag: "wx" }); }
  } catch (error) {
    await removePltFile(document).catch(cleanupError => console.error("Pembersihan unggahan SK Plt. gagal", cleanupError));
    throw error;
  }
  return document;
}
export async function removePltFile(document: PltDocument) {
  if (!pattern.test(document.storageName)) return;
  if (isStorageConfigured()) await deleteStorageObject(document.storageName);
  else await rm(path.join(directory, document.storageName), { force: true });
}
export async function readPltFile(document: PltDocument) {
  if (!pattern.test(document.storageName) || !Object.values(mimeTypes).includes(document.mimeType)) return null;
  return downloadStorageObject(document.storageName, path.join(directory, document.storageName));
}
