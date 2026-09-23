import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import PizZip from "pizzip";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const backupBaseDirectory = path.join(projectRoot, ".migration-backups");

async function latestBackupDirectory() {
  const directories = (await readdir(backupBaseDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("adminflow-"))
    .map((entry) => path.join(backupBaseDirectory, entry.name));
  if (directories.length === 0) throw new Error("Backup AdminFlow belum ditemukan.");
  const candidates = await Promise.all(directories.map(async (directory) => ({ directory, modified: (await stat(directory)).mtimeMs })));
  return candidates.sort((left, right) => right.modified - left.modified)[0].directory;
}

const backupDirectory = process.argv[2] ? path.resolve(process.argv[2]) : await latestBackupDirectory();
const manifest = JSON.parse(await readFile(path.join(backupDirectory, "manifest.json"), "utf8"));
const restoreDirectory = path.join(projectRoot, ".restore-tests", manifest.backupId);

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function copyVerified(sourcePath, destinationPath, expected) {
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
  const info = await stat(destinationPath);
  const hash = await sha256(destinationPath);
  if (info.size !== expected.size || hash !== expected.sha256) throw new Error(`Restore hash/size berbeda: ${expected.path}`);
}

function inspectDocument(filePath, bytes) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".docx") {
    const zip = new PizZip(bytes);
    if (!zip.file("word/document.xml")) throw new Error(`DOCX tidak memiliki word/document.xml: ${filePath}`);
  } else if (extension === ".pdf") {
    if (bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error(`Signature PDF tidak valid: ${filePath}`);
  } else if (extension === ".doc") {
    const signature = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    if (!bytes.subarray(0, 8).equals(signature)) throw new Error(`Signature DOC tidak valid: ${filePath}`);
  }
}

await rm(restoreDirectory, { recursive: true, force: true });
await mkdir(restoreDirectory, { recursive: true });
await copyVerified(
  path.join(backupDirectory, manifest.database.path),
  path.join(restoreDirectory, "data", "admin.db"),
  { ...manifest.database, path: manifest.database.path },
);

for (const file of manifest.files) {
  const backupRelativePath = file.path.replace(/^data\//, "");
  const destinationPath = path.join(restoreDirectory, file.path);
  await copyVerified(path.join(backupDirectory, "files", "data", backupRelativePath), destinationPath, file);
  inspectDocument(destinationPath, await readFile(destinationPath));
}

for (const file of manifest.source.files) {
  await copyVerified(path.join(backupDirectory, "source", file.path), path.join(restoreDirectory, "source", file.path), file);
}

const restoredDatabase = new Database(path.join(restoreDirectory, "data", "admin.db"), { readonly: true, fileMustExist: true });
restoredDatabase.pragma("query_only = ON");
const integrityCheck = restoredDatabase.pragma("integrity_check").map((row) => row.integrity_check);
const foreignKeyViolations = restoredDatabase.pragma("foreign_key_check");
const restoredCounts = {};
for (const [table, expectedCount] of Object.entries(manifest.database.tableCounts)) {
  const safeTable = `"${table.replaceAll('"', '""')}"`;
  restoredCounts[table] = restoredDatabase.prepare(`SELECT COUNT(*) AS count FROM ${safeTable}`).get().count;
  if (restoredCounts[table] !== expectedCount) throw new Error(`Jumlah baris ${table} berbeda setelah restore.`);
}
restoredDatabase.close();
if (integrityCheck.length !== 1 || integrityCheck[0] !== "ok") throw new Error(`Integrity check restore gagal: ${integrityCheck.join(", ")}`);
if (foreignKeyViolations.length > 0) throw new Error(`Restore memiliki ${foreignKeyViolations.length} pelanggaran foreign key.`);

console.log(JSON.stringify({
  backupDirectory,
  restoreDirectory,
  integrityCheck,
  foreignKeyViolationCount: foreignKeyViolations.length,
  tableCounts: restoredCounts,
  verifiedDataFiles: manifest.files.length,
  verifiedSourceFiles: manifest.source.files.length,
  missingReferences: manifest.missingReferences.length,
  orphanedFiles: manifest.orphanedFiles.length,
  sizeMismatches: manifest.sizeMismatches?.length ?? 0,
}, null, 2));
