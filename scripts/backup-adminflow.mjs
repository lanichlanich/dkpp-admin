import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const sourceDatabasePath = path.join(projectRoot, "data", "admin.db");
const backupBaseDirectory = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(projectRoot, ".migration-backups");
const backupId = new Date().toISOString().replace(/[:.]/g, "-");
const backupDirectory = path.join(backupBaseDirectory, `adminflow-${backupId}`);
const backupDatabasePath = path.join(backupDirectory, "database", "admin.db");
const backupFilesDirectory = path.join(backupDirectory, "files", "data");
const backupSourceDirectory = path.join(backupDirectory, "source");

const excludedSourceNames = new Set([
  ".git",
  ".migration-backups",
  ".next",
  ".restore-tests",
  ".tmp",
  "data",
  "node_modules",
]);

const documentStores = [
  { table: "employee_documents", directory: "employee-documents", storedName: (row) => row.storage_name },
  { table: "kgb_documents", directory: "kgb-documents", storedName: (row) => row.storage_name },
  { table: "dpcp_documents", directory: "dpcp-documents", storedName: (row) => row.storage_name },
  { table: "pak_documents", directory: "pak-documents", storedName: (row) => row.storage_name },
  { table: "wfh_documents", directory: "wfh-documents", storedName: (row) => row.storage_name },
  { table: "surat_pengantar_documents", directory: "surat-pengantar-documents", storedName: (row) => row.storage_name },
  { table: "official_statement_documents", directory: "official-statement-documents", storedName: (row) => row.storage_name },
  { table: "wfh_reports", directory: "wfh-reports", storedName: (row) => `${row.id}.docx` },
];

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function sha256(filePath) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

async function listFiles(directory, relativeDirectory = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(absolutePath, relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

async function copyAndDescribe(sourcePath, destinationPath, relativePath) {
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
  const [sourceInfo, sourceHash, destinationHash] = await Promise.all([
    stat(sourcePath),
    sha256(sourcePath),
    sha256(destinationPath),
  ]);
  if (sourceHash !== destinationHash) throw new Error(`Hash salinan berbeda: ${relativePath}`);
  return { path: relativePath.replaceAll("\\", "/"), size: sourceInfo.size, sha256: sourceHash };
}

async function copySourceSnapshot() {
  const copied = [];
  async function visit(currentDirectory, relativeDirectory = "") {
    for (const entry of await readdir(currentDirectory, { withFileTypes: true })) {
      if (!relativeDirectory && excludedSourceNames.has(entry.name)) continue;
      if (!relativeDirectory && entry.name.startsWith(".env")) continue;
      const relativePath = path.join(relativeDirectory, entry.name);
      const sourcePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) await visit(sourcePath, relativePath);
      else if (entry.isFile()) copied.push(await copyAndDescribe(sourcePath, path.join(backupSourceDirectory, relativePath), relativePath));
    }
  }
  await visit(projectRoot);
  return copied.sort((left, right) => left.path.localeCompare(right.path));
}

async function environmentVariableNames() {
  try {
    const text = await readFile(path.join(projectRoot, ".env.local"), "utf8");
    return [...new Set(text.split(/\r?\n/)
      .map((line) => line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
      .filter(Boolean))].sort();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

await mkdir(path.dirname(backupDatabasePath), { recursive: true });
const sourceDatabase = new Database(sourceDatabasePath, { fileMustExist: true });
await sourceDatabase.backup(backupDatabasePath);
sourceDatabase.close();

const backupDatabase = new Database(backupDatabasePath, { readonly: true, fileMustExist: true });
backupDatabase.pragma("query_only = ON");
const tableNames = backupDatabase.prepare(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
).all().map((row) => row.name);
const tableCounts = Object.fromEntries(tableNames.map((table) => [
  table,
  backupDatabase.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`).get().count,
]));
const integrityCheck = backupDatabase.pragma("integrity_check").map((row) => row.integrity_check);
const foreignKeyViolations = backupDatabase.pragma("foreign_key_check");
if (integrityCheck.length !== 1 || integrityCheck[0] !== "ok") throw new Error(`Integrity check gagal: ${integrityCheck.join(", ")}`);
if (foreignKeyViolations.length > 0) throw new Error(`Ditemukan ${foreignKeyViolations.length} pelanggaran foreign key.`);

const references = [];
for (const store of documentStores) {
  if (!tableNames.includes(store.table)) continue;
  const rows = backupDatabase.prepare(`SELECT * FROM ${quoteIdentifier(store.table)} ORDER BY id`).all();
  for (const row of rows) {
    const storedName = store.storedName(row);
    references.push({
      table: store.table,
      id: row.id,
      path: `data/${store.directory}/${storedName}`,
      storedName,
      originalName: row.original_file_name ?? row.file_name ?? null,
      recordedSize: row.file_size ?? null,
    });
  }
}
backupDatabase.close();

const dataFiles = [];
for (const entry of await readdir(path.join(projectRoot, "data"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const sourceDirectory = path.join(projectRoot, "data", entry.name);
  for (const relativeFile of await listFiles(sourceDirectory)) {
    const dataRelativePath = path.join(entry.name, relativeFile);
    dataFiles.push(await copyAndDescribe(
      path.join(sourceDirectory, relativeFile),
      path.join(backupFilesDirectory, dataRelativePath),
      `data/${dataRelativePath}`,
    ));
  }
}
dataFiles.sort((left, right) => left.path.localeCompare(right.path));

const sourceFiles = await copySourceSnapshot();
const referencedPaths = new Set(references.map((item) => item.path.toLowerCase()));
const copiedPaths = new Set(dataFiles.map((item) => item.path.toLowerCase()));
const copiedFilesByPath = new Map(dataFiles.map((item) => [item.path.toLowerCase(), item]));
const missingReferences = references.filter((item) => !copiedPaths.has(item.path.toLowerCase()));
const orphanedFiles = dataFiles.filter((item) => !referencedPaths.has(item.path.toLowerCase()));
const sizeMismatches = references.filter((item) => {
  const copiedFile = copiedFilesByPath.get(item.path.toLowerCase());
  return copiedFile && item.recordedSize !== null && copiedFile.size !== item.recordedSize;
});
if (missingReferences.length > 0) throw new Error(`${missingReferences.length} referensi database tidak memiliki berkas.`);
if (sizeMismatches.length > 0) throw new Error(`${sizeMismatches.length} ukuran berkas berbeda dari metadata database.`);

const databaseInfo = await stat(backupDatabasePath);
const manifest = {
  formatVersion: 1,
  backupId,
  createdAt: new Date().toISOString(),
  database: {
    path: "database/admin.db",
    size: databaseInfo.size,
    sha256: await sha256(backupDatabasePath),
    integrityCheck,
    foreignKeyViolationCount: foreignKeyViolations.length,
    tableCounts,
  },
  files: dataFiles,
  documentReferences: references,
  missingReferences,
  orphanedFiles,
  sizeMismatches,
  source: {
    path: "source",
    files: sourceFiles,
    excluded: [...excludedSourceNames, ".env*"].sort(),
    environmentVariableNames: await environmentVariableNames(),
    environmentValuesIncluded: false,
  },
};
await writeFile(path.join(backupDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
await writeFile(path.join(backupDirectory, "README.txt"), [
  "AdminFlow migration backup",
  `Backup ID: ${backupId}`,
  "Nilai rahasia .env.local sengaja tidak dimasukkan. Simpan nilainya di pengelola rahasia terpisah.",
  "Jalankan: npm.cmd run verify:backup -- \"<direktori-backup>\"",
  "",
].join("\r\n"), { flag: "wx" });

console.log(JSON.stringify({
  backupDirectory,
  databaseTables: tableNames.length,
  tableRows: Object.values(tableCounts).reduce((total, count) => total + count, 0),
  documentReferences: references.length,
  copiedDataFiles: dataFiles.length,
  copiedDataBytes: dataFiles.reduce((total, file) => total + file.size, 0),
  sourceFiles: sourceFiles.length,
  missingReferences: missingReferences.length,
  orphanedFiles: orphanedFiles.length,
  sizeMismatches: sizeMismatches.length,
  environmentVariableNames: manifest.source.environmentVariableNames,
}, null, 2));
