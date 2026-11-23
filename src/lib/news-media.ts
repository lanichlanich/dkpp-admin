import "server-only";
import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NEWS_MEDIA_DIRECTORY, newsMediaNamePattern } from "@/lib/news-media-types";
import { MAX_UPLOAD_SIZE_BYTES } from "@/lib/upload-limits";

const directory = () => path.join(process.cwd(), "data", NEWS_MEDIA_DIRECTORY);
export async function readNewsUpload(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_UPLOAD_SIZE_BYTES) return null;
  if (!request.body) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let length = 0;
  const reader = request.body.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_UPLOAD_SIZE_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    return Buffer.concat(chunks, length);
  } finally { reader.releaseLock(); }
}
export async function prepareNewsImage(bytes: Buffer) {
  try {
    const input = sharp(bytes, { limitInputPixels: 20_000_000, autoOrient: true, failOn: "warning" });
    const { format, pages } = await input.metadata();
    if (!format || !["jpeg", "png", "webp"].includes(format) || (pages ?? 1) > 1) return null;
    const result = await input.resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    return result.length <= MAX_UPLOAD_SIZE_BYTES ? result : null;
  } catch { return null; }
}
export async function storeNewsImage(bytes: Buffer) {
  const name = `${randomUUID()}.webp`;
  await mkdir(directory(), { recursive: true, mode: 0o750 });
  await writeFile(path.join(directory(), name), bytes, { flag: "wx", mode: 0o640 });
  return name;
}
export function readNewsImage(name: string) {
  if (!newsMediaNamePattern.test(name)) throw new Error("Nama gambar berita tidak valid.");
  return readFile(path.join(directory(), name));
}

export async function newsImageExists(name: string) {
  if (!newsMediaNamePattern.test(name)) return false;
  try { await access(path.join(directory(), name)); return true; } catch { return false; }
}
