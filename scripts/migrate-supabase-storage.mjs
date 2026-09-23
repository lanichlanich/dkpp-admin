import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "dkpp-admin";
const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const secretKey = process.env.SUPABASE_SECRET_KEY;
const maxBytes = Number(process.env.SUPABASE_STORAGE_MIGRATION_MAX_BYTES || 2 * 1024 * 1024);
const dryRun = process.argv.includes("--dry-run");

if (!dryRun && (!baseUrl || !secretKey)) {
  throw new Error("SUPABASE_URL dan SUPABASE_SECRET_KEY wajib diisi.");
}

const files = [];
for (const directory of [
  "dpcp-documents",
  "employee-documents",
  "official-statement-documents",
  "pak-documents",
  "surat-pengantar-documents",
  "wfh-documents",
  "wfh-reports",
]) {
  const directoryPath = path.join(root, "data", directory);
  try {
    const entries = await (await import("node:fs/promises")).readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.(pdf|doc|docx)$/i.test(entry.name)) {
        files.push({ name: entry.name, filePath: path.join(directoryPath, entry.name) });
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
  if (bytes.length > maxBytes) {
    skipped += 1;
    console.log(`SKIP ${file.name}: ${bytes.length} bytes > ${maxBytes}`);
    continue;
  }
  const extension = path.extname(file.name).toLowerCase();
  const contentType = extension === ".pdf"
    ? "application/pdf"
    : extension === ".doc"
      ? "application/msword"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (dryRun) {
    console.log(`DRY-RUN ${file.name}: ${bytes.length} bytes`);
    continue;
  }
  const response = await fetch(`${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(file.name)}`, {
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
