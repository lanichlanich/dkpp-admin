import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pdfTools, type PdfTool } from "./pdf-tools-config";

type Operation = PdfTool["operation"];
type Result = { name: string; bytes: Buffer; pages: number };
type DocumentMetadata = { name: string; pages: number; size: number };
export type PdfToolDocument = DocumentMetadata & { id: string; operation: Operation; createdAt: string };

export const PDF_TOOLS_DOCUMENT_CAP = 200;
const OWNER_BYTE_CAP = 512 * 1024 * 1024;
const JOB_BYTE_CAP = 32 * 1024 * 1024;
const MAX_PAGES = 150;
const MAX_NAME_LENGTH = 160;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class PdfToolsDocumentError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function ownerDirectory(ownerId: string) {
  if (typeof ownerId !== "string" || !ownerId.trim()) throw new Error("Missing PDF archive owner");
  // Do not write private files to ephemeral serverless storage.
  if (process.env.VERCEL === "1") throw new PdfToolsDocumentError("Arsip PDF memerlukan penyimpanan lokal persisten.", 503);
  return join(process.cwd(), "data", "pdf-tools-documents", createHash("sha256").update(ownerId).digest("hex"));
}

function normalizeName(value: unknown) {
  if (typeof value === "string" && value.isWellFormed() && !/[\p{Cc}\p{Cf}<>:"/\\|?*]/u.test(value)) {
    const stem = value.trim().replace(/\.pdf$/i, "").trimEnd();
    const name = `${stem}.pdf`;
    if (stem && !/^\.+$/.test(stem) && name.length <= MAX_NAME_LENGTH) return name;
  }
  throw new PdfToolsDocumentError(`Nama dokumen tidak valid. Gunakan maksimal ${MAX_NAME_LENGTH} karakter termasuk .pdf, tanpa karakter khusus nama berkas.`, 400);
}

function isOperation(value: unknown): value is Operation {
  return pdfTools.some(tool => tool.operation === value);
}
function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function errorCode(error: unknown) { return (error as NodeJS.ErrnoException | undefined)?.code; }
function uuidDirectories(path: string) {
  try {
    return readdirSync(path, { withFileTypes: true }).filter(entry => entry.isDirectory() && UUID.test(entry.name)).map(entry => entry.name);
  } catch (error) { if (errorCode(error) === "ENOENT") return []; throw error; }
}

function readRecord(path: string): Record<string, unknown> | null {
  try {
    if (!lstatSync(path).isFile()) return null;
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
  } catch (error) { if (errorCode(error) === "ENOENT" || error instanceof SyntaxError) return null; throw error; }
}

function readJob(path: string, ownerId: string) {
  const record = readRecord(join(path, "job.json"));
  if (!record || record.ownerId !== ownerId || !isOperation(record.operation) || typeof record.createdAt !== "string") return null;
  const timestamp = Date.parse(record.createdAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== record.createdAt) return null;
  return { operation: record.operation, createdAt: record.createdAt };
}

function documentMetadata(job: NonNullable<ReturnType<typeof readJob>>, directory: string, id: string): PdfToolDocument | null {
  const record = readRecord(join(directory, "document.json"));
  if (!record || typeof record.name !== "string" || !positiveInteger(record.pages) || record.pages > MAX_PAGES || !positiveInteger(record.size) || record.size > JOB_BYTE_CAP) return null;
  try { if (normalizeName(record.name) !== record.name) return null; } catch { return null; }
  return { ...job, id, name: record.name, pages: record.pages, size: record.size };
}

function locate(ownerId: string, id: string) {
  if (!UUID.test(id)) return null;
  const ownerPath = ownerDirectory(ownerId);
  for (const jobId of uuidDirectories(ownerPath)) {
    const jobPath = join(ownerPath, jobId);
    const job = readJob(jobPath, ownerId);
    if (!job || !uuidDirectories(jobPath).includes(id)) continue;
    const documentPath = join(jobPath, id);
    const row = documentMetadata(job, documentPath, id);
    if (row) return { row, ownerPath, jobPath, documentPath };
  }
  return null;
}

function rowsFor(ownerPath: string, ownerId: string) {
  const rows: PdfToolDocument[] = [];
  for (const jobId of uuidDirectories(ownerPath)) {
    const jobPath = join(ownerPath, jobId);
    const job = readJob(jobPath, ownerId);
    if (!job) continue;
    for (const id of uuidDirectories(jobPath)) {
      const row = documentMetadata(job, join(jobPath, id), id);
      if (row) rows.push(row);
    }
  }
  return rows;
}

function syncDirectory(path: string) {
  const fd = openSync(path, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function writeRecord(path: string, data: unknown) {
  writeFileSync(path, JSON.stringify(data), { flag: "wx", mode: 0o600, flush: true });
}

// One persistent Node process owns the archive; synchronous mutations keep quota checks,
// job publication and metadata changes serialized across route handlers in that process.
export async function savePdfToolDocuments(ownerId: string, operation: Operation, results: Result[]): Promise<{ id: string }[]> {
  if (!isOperation(operation) || !results.length || results.length > MAX_PAGES || (operation !== "split" && results.length !== 1)) {
    throw new PdfToolsDocumentError("Hasil Tools PDF tidak valid.", 400);
  }
  const entries = results.map(({ name, bytes, pages }) => {
    if (!Buffer.isBuffer(bytes) || bytes.subarray(0, 5).toString("ascii") !== "%PDF-" || !positiveInteger(pages)) {
      throw new PdfToolsDocumentError("Hasil Tools PDF tidak valid.", 400);
    }
    return { id: randomUUID(), bytes, metadata: { name: normalizeName(name), size: bytes.length, pages } };
  });
  const bytes = entries.reduce((total, entry) => total + entry.metadata.size, 0);
  if (bytes > JOB_BYTE_CAP || entries.reduce((total, entry) => total + entry.metadata.pages, 0) > MAX_PAGES) {
    throw new PdfToolsDocumentError("Hasil Tools PDF terlalu besar untuk disimpan.", 413);
  }
  const ownerPath = ownerDirectory(ownerId);
  const existing = rowsFor(ownerPath, ownerId);
  if (existing.length + entries.length > PDF_TOOLS_DOCUMENT_CAP || existing.reduce((total, row) => total + row.size, bytes) > OWNER_BYTE_CAP) {
    throw new PdfToolsDocumentError("Arsip PDF penuh. Hapus dokumen dari Daftar Dokumen sebelum menyimpan lagi.", 409);
  }
  const archive = dirname(ownerPath);
  mkdirSync(ownerPath, { recursive: true, mode: 0o700 });
  syncDirectory(dirname(archive));
  syncDirectory(archive);
  const jobId = randomUUID();
  const staging = join(ownerPath, `.stage-${jobId}`);
  mkdirSync(staging, { mode: 0o700 });
  try {
    writeRecord(join(staging, "job.json"), { ownerId, operation, createdAt: new Date().toISOString() });
    for (const { id, bytes, metadata } of entries) {
      const directory = join(staging, id);
      mkdirSync(directory, { mode: 0o700 });
      writeRecord(join(directory, "document.json"), metadata);
      writeFileSync(join(directory, "output.pdf"), bytes, { flag: "wx", mode: 0o600, flush: true });
      syncDirectory(directory);
    }
    syncDirectory(staging);
    renameSync(staging, join(ownerPath, jobId));
    syncDirectory(ownerPath);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  return entries.map(({ id }) => ({ id }));
}

export async function listPdfToolDocuments(ownerId: string): Promise<PdfToolDocument[]> {
  return rowsFor(ownerDirectory(ownerId), ownerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name, "id") || a.id.localeCompare(b.id));
}

export async function readPdfToolDocument(ownerId: string, id: string) {
  const target = locate(ownerId, id);
  if (!target) return null;
  const path = join(target.documentPath, "output.pdf");
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.size !== target.row.size) return null;
    return { ...target.row, bytes: readFileSync(path) };
  } catch (error) { if (errorCode(error) === "ENOENT") return null; throw error; }
}

export async function renamePdfToolDocument(ownerId: string, id: string, value: unknown) {
  const target = locate(ownerId, id);
  if (!target) return null;
  const name = normalizeName(value);
  const staging = join(target.documentPath, `.rename-${randomUUID()}.json`);
  try {
    writeRecord(staging, { name, size: target.row.size, pages: target.row.pages });
    renameSync(staging, join(target.documentPath, "document.json"));
    syncDirectory(target.documentPath);
  } finally {
    rmSync(staging, { force: true });
  }
  return { ...target.row, name };
}

export async function deletePdfToolDocument(ownerId: string, id: string) {
  const target = locate(ownerId, id);
  if (!target) return false;
  const last = uuidDirectories(target.jobPath).length === 1;
  const parent = last ? target.ownerPath : target.jobPath;
  const tomb = join(parent, `.delete-${randomUUID()}`);
  renameSync(last ? target.jobPath : target.documentPath, tomb);
  syncDirectory(parent);
  rmSync(tomb, { recursive: true, force: true });
  syncDirectory(parent);
  return true;
}
