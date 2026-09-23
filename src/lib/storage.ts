import "server-only";

import { readFile } from "node:fs/promises";

const bucket = process.env.SUPABASE_STORAGE_BUCKET || "dkpp-admin";
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const secretKey = process.env.SUPABASE_SECRET_KEY;

function storageUrl(storageName: string) {
  if (!supabaseUrl || !secretKey) return null;
  return `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(storageName)}`;
}

export async function downloadStorageObject(storageName: string, fallbackPath?: string) {
  const url = storageUrl(storageName);
  if (!url) {
    if (!fallbackPath) throw new Error("Supabase Storage belum dikonfigurasi.");
    return readFile(fallbackPath);
  }
  const response = await fetch(url, {
    headers: { apikey: secretKey!, authorization: `Bearer ${secretKey!}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Storage download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
