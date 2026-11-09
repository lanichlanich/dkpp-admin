import "server-only";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { deleteStorageObject, downloadStorageObject, isStorageConfigured, uploadStorageObject } from "@/lib/storage";
import { MAX_UPLOAD_SIZE_BYTES } from "@/lib/upload-limits";
import { LIBRARY_COVER_BUCKET, LIBRARY_COVER_DIRECTORY, LIBRARY_COVER_MIME, libraryCoverNamePattern } from "@/lib/library-cover-types";

const directory = path.join(process.cwd(), "data", LIBRARY_COVER_DIRECTORY);

function localPath(name: string) {
  if (!libraryCoverNamePattern.test(name)) throw new Error("Nama file cover tidak valid.");
  return path.join(directory, name);
}

export async function prepareLibraryCover(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const jpeg = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!jpeg && !png && !webp) return null;

  try {
    const cover = await sharp(bytes, { limitInputPixels: 20_000_000, autoOrient: true })
      .resize({ width: 800, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return cover.length <= MAX_UPLOAD_SIZE_BYTES ? cover : null;
  } catch {
    return null;
  }
}

export async function storeLibraryCover(name: string, bytes: Buffer) {
  const destination = localPath(name);
  if (isStorageConfigured()) {
    await uploadStorageObject(name, bytes, LIBRARY_COVER_MIME, { bucket: LIBRARY_COVER_BUCKET, upsert: false });
    return;
  }
  await mkdir(directory, { recursive: true });
  await writeFile(destination, bytes, { flag: "wx" });
}

export function readLibraryCover(name: string) {
  return downloadStorageObject(name, localPath(name), LIBRARY_COVER_BUCKET);
}

export async function discardLibraryCover(name: string | null | undefined) {
  if (!name || !libraryCoverNamePattern.test(name)) return;
  try {
    if (isStorageConfigured()) await deleteStorageObject(name, LIBRARY_COVER_BUCKET);
    else await rm(localPath(name), { force: true });
  } catch (error) {
    console.error("Gagal membersihkan file cover buku", error);
  }
}
