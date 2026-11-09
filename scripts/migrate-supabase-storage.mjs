import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "dkpp-admin";
const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const secretKey = process.env.SUPABASE_SECRET_KEY;
const maxBytes = Number(process.env.SUPABASE_STORAGE_MIGRATION_MAX_BYTES ?? 0);
const dryRun = process.argv.includes("--dry-run");

if (!dryRun && (!baseUrl || !secretKey)) {
  throw new Error("SUPABASE_URL dan SUPABASE_SECRET_KEY wajib diisi.");
}

const files = [];
for (const directory of [
  "dpcp-documents",
  "kgb-documents",
  "kgb-signed-documents",
  "employee-documents",
  "official-statement-documents",
  "pak-documents",
  "surat-pengantar-documents",
  "kerjaku-request-documents",
  "kak-documents",
  "wfh-documents",
  "wfh-reports",
  "wfh-schedule-letters",
  "library-book-covers",
]) {
  const directoryPath = path.join(root, "data", directory);
  try {
    const entries = await (await import("node:fs/promises")).readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      const cover = directory === "library-book-covers";
      const valid = cover ? /^[a-f0-9-]{36}\.webp$/.test(entry.name) : /\.(pdf|doc|docx)$/i.test(entry.name);
      if (entry.isFile() && valid) {
        files.push({ name: entry.name, filePath: path.join(directoryPath, entry.name), bucket: cover ? "dkpp-library-covers" : bucket });
      }
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
}

let uploaded = 0;
let skipped = 0;
for (const file of files) {
  const bytes = await readFile(file.filePath);
  if (maxBytes > 0 && bytes.length > maxBytes) {
    skipped += 1;
    console.log(`SKIP ${file.name}: ${bytes.length} bytes > ${maxBytes}`);
    continue;
  }
  const extension = path.extname(file.name).toLowerCase();
  const contentType = extension === ".webp"
    ? "image/webp"
    : extension === ".pdf"
    ? "application/pdf"
    : extension === ".doc"
      ? "application/msword"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (dryRun) {
    console.log(`DRY-RUN ${file.name}: ${bytes.length} bytes`);
    continue;
  }
  const response = await fetch(`${baseUrl}/storage/v1/object/${encodeURIComponent(file.bucket)}/${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: {
      apikey: secretKey,
      authorization: `Bearer ${secretKey}`,
      "content-type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!response.ok) {
    throw new Error(`Upload ${file.name} gagal (${response.status}): ${await response.text()}`);
  }
  uploaded += 1;
  console.log(`OK ${file.name}`);
}

console.log(JSON.stringify({ total: files.length, uploaded, skipped, dryRun }));
