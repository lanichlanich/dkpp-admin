import "server-only";

import { readFile } from "node:fs/promises";

const bucket = process.env.SUPABASE_STORAGE_BUCKET || "dkpp-admin";
const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

export function isStorageConfigured() {
  return Boolean(supabaseUrl && secretKey);
}

async function signStorageObject(storageName: string, upload: boolean) {
  if (!supabaseUrl || !secretKey) throw new Error("Supabase Storage belum dikonfigurasi.");
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${upload ? "upload/sign" : "sign"}/${encodeURIComponent(bucket)}/${encodeURIComponent(storageName)}`, {
    method: "POST",
    headers: { apikey: secretKey, authorization: `Bearer ${secretKey}`, "content-type": "application/json" },
    body: JSON.stringify(upload ? {} : { expiresIn: 60 }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Storage signing failed: ${response.status}`);
  const payload = await response.json() as { url?: string; signedURL?: string };
  const signedPath = upload ? payload.url : payload.signedURL;
  if (!signedPath?.startsWith("/object/")) throw new Error("Storage signed URL tidak valid.");
  return new URL(`${supabaseUrl}/storage/v1${signedPath}`);
}

// Upload tokens permit one new object only; never enable upsert for staged archives.
export async function createStorageUploadUrl(storageName: string) {
  return (await signStorageObject(storageName, true)).toString();
}

export async function createStorageDownloadUrl(storageName: string, fileName: string) {
  const url = await signStorageObject(storageName, false);
  url.searchParams.set("download", fileName);
  return url.toString();
}

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

export async function deleteStorageObject(storageName: string) {
  if (!supabaseUrl || !secretKey) return;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: "DELETE",
    headers: { apikey: secretKey, authorization: `Bearer ${secretKey}`, "content-type": "application/json" },
    body: JSON.stringify({ prefixes: [storageName] }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Storage cleanup failed: ${response.status}`);
}
