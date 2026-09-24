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
  const headers = { apikey: secretKey!, authorization: `Bearer ${secretKey!}` };
  const response = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (response.ok) return Buffer.from(await response.arrayBuffer());

  // Private buckets also expose the authenticated download path. Keep this
  // fallback for projects whose Storage gateway does not accept the generic
  // object path with a server key.
  const authenticatedUrl = `${supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodeURIComponent(storageName)}`;
  const authenticatedResponse = await fetch(authenticatedUrl, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!authenticatedResponse.ok) {
    throw new Error(`Storage download failed: ${response.status}/${authenticatedResponse.status}`);
  }
  return Buffer.from(await authenticatedResponse.arrayBuffer());
}

export async function uploadStorageObject(storageName: string, file: Buffer, contentType = "application/octet-stream") {
  if (!supabaseUrl || !secretKey) return;
  const url = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(storageName)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: secretKey,
      authorization: `Bearer ${secretKey}`,
      "content-type": contentType,
      "x-upsert": "true",
    },
    body: new Uint8Array(file),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Storage upload failed: ${response.status}`);
}
