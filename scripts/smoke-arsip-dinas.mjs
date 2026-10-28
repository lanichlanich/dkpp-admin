import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import Database from "better-sqlite3";
import ts from "typescript";

const require = createRequire(import.meta.url), modules = new Map(), objects = new Map();
const db = new Database(":memory:"); db.pragma("foreign_keys = ON");
db.exec("CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('owner'), ('other')");
const schema = readFileSync("src/lib/db.ts", "utf8");
for (const table of ["service_archive_documents", "service_archive_uploads"]) db.exec(schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n  \\);`))[0]);
let userId = "owner", allowed = true, failWrite = false, failDelete = false, cloud = true, signs = 0, aiCalls = 0;
const adapter = { transaction: async statements => db.transaction(() => { for (const item of statements) { if (failWrite) throw new Error("Simulated transaction outage"); db.prepare(item.sql).run(...item.values); } })(), prepare(sql) { const query = db.prepare(sql); return {
  get: async (...v) => query.get(...v), all: async (...v) => query.all(...v),
  run: async (...v) => { if (failWrite && /INSERT INTO service_archive_documents/.test(sql)) throw new Error("Simulated database outage"); return query.run(...v); },
}; } };
function load(file) {
  const filename = path.resolve(file); if (modules.has(filename)) return modules.get(filename).exports;
  const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); modules.set(filename, mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name === "@/lib/database") return { database: adapter };
    if (name === "@/lib/session") return { getCurrentUser: async () => userId ? { id: userId } : null };
    if (name === "@/lib/authorization") return { checkApiAccess: async menus => !userId ? Response.json({}, { status: 401 }) : !allowed || !menus.includes("arsip-dinas") ? Response.json({}, { status: 403 }) : null };
    if (name === "@/lib/storage") return {
      isStorageConfigured: () => cloud,
      createStorageUploadUrl: async name => { signs++; return `https://storage.example/upload/${name}?token=temporary`; },
      createStorageDownloadUrl: async (name, download) => `https://storage.example/download/${name}?download=${encodeURIComponent(download)}`,
      downloadStorageObject: async name => { if (!objects.has(name)) throw new Error("Missing object"); return objects.get(name); },
      uploadStorageObject: async (name, bytes) => objects.set(name, bytes), deleteStorageObject: async name => { if (failDelete) throw new Error("Simulated storage outage"); objects.delete(name); },
    };
    if (name === "@/lib/gemini-client") return { GeminiApiError: class extends Error {}, requestGeminiJson: async () => { aiCalls++; return { value: { values: { namaDokumen: "Arsip 10 MB" }, confidence: { namaDokumen: "high" }, warnings: [], identityMismatch: false }, model: "fixture" }; } };
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const uploadApi = load("src/app/api/arsip-dinas/upload/route.ts"), api = load("src/app/api/arsip-dinas/route.ts");
const downloads = load("src/app/api/arsip-dinas/[id]/download/route.ts"), ai = load("src/app/api/document-ai/extract/route.ts");
const rowApi = load("src/app/api/arsip-dinas/[id]/route.ts");
const service = load("src/lib/arsip-dinas.ts"), { readArchiveUpload } = load("src/lib/archive-uploads.ts");
const { MAX_ARCHIVE_UPLOAD_SIZE_BYTES: max, MAX_UPLOAD_SIZE_BYTES: otherMax } = load("src/lib/upload-limits.ts");
assert.equal(max, 10 * 1024 * 1024); assert.equal(otherMax, 2 * 1024 * 1024);
const pdf = Buffer.alloc(max, 32); pdf.write("%PDF-1.4\n"); pdf.write("\n%%EOF", pdf.length - 6);
const fields = { namaDokumen: "Arsip Uji 10 MB", nomor: "UJI/10", jenisDokumen: "Surat Uji", tglDokumen: "2026-10-28" };
const json = body => new Request("http://localhost/api/arsip-dinas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const prepare = fileSize => uploadApi.POST(json({ fileName: "Arsip.pdf", fileSize, contentType: "application/pdf" }));
const remove = (doc, body = { confirmed: true, updatedAt: doc.updatedAt }) => rowApi.DELETE(new Request("http://localhost/api/arsip-dinas", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: doc.id }) });
try {
  assert.equal((await prepare(max + 1)).status, 413); assert.equal(signs, 0);
  assert.equal((await prepare(0)).status, 422);
  assert.equal((await uploadApi.POST(json({ fileName: "x.doc", fileSize: 10, contentType: "application/msword" }))).status, 422);
  const prepared = await prepare(max); assert.equal(prepared.status, 200);
  const { uploadId } = await prepared.json(); objects.set(`${uploadId}.pdf`, pdf);
  userId = "other";
  assert.equal((await api.POST(json({ ...fields, uploadId }))).status, 422);
  assert.equal((await ai.POST(json({ kind: "official-archive", uploadId }))).status, 422); assert.equal(aiCalls, 0);
  userId = "owner";
  assert.equal((await ai.POST(json({ kind: "official-archive", uploadId }))).status, 200); assert.equal(aiCalls, 1);
  objects.set(`${uploadId}.pdf`, Buffer.concat([pdf, Buffer.from("x")]));
  assert.equal((await api.POST(json({ ...fields, uploadId }))).status, 413);
  objects.set(`${uploadId}.pdf`, Buffer.from("%PDF-1.4"));
  assert.equal((await api.POST(json({ ...fields, uploadId }))).status, 422);
  objects.set(`${uploadId}.pdf`, Buffer.alloc(max));
  assert.equal((await api.POST(json({ ...fields, uploadId }))).status, 422);
  objects.set(`${uploadId}.pdf`, pdf);
  failWrite = true; assert.equal((await api.POST(json({ ...fields, uploadId }))).status, 500);
  assert.equal(objects.get(`${uploadId}.pdf`), pdf); assert.equal(db.prepare("SELECT count(*) n FROM service_archive_uploads").get().n, 1);
  failWrite = false;
  const saved = await api.POST(json({ ...fields, uploadId })); assert.equal(saved.status, 201);
  const doc = (await saved.json()).document; assert.equal(doc.fileSize, max); assert.equal(doc.fileName, `${fields.namaDokumen}.pdf`);
  assert.equal((await api.POST(json({ ...fields, uploadId }))).status, 201);
  assert.equal(db.prepare("SELECT count(*) n FROM service_archive_documents").get().n, 1, "Save retry must not duplicate the archive");
  let response = await downloads.GET(new Request("http://localhost"), { params: Promise.resolve({ id: doc.id }) });
  assert.equal(response.status, 302); assert(response.headers.get("cache-control").includes("no-store"));
  assert.equal(new URL(response.headers.get("location")).searchParams.get("download"), doc.fileName);
  const expired = (await (await prepare(8)).json()).uploadId;
  objects.set(`${expired}.pdf`, Buffer.from("%PDF-1.4"));
  db.prepare("UPDATE service_archive_uploads SET expires_at = ?, created_at = ? WHERE id = ?").run("2000-01-01T00:00:00.000Z", "2000-01-01T00:00:00.000Z", expired);
  await assert.rejects(() => readArchiveUpload(userId, expired));
  await prepare(8); assert(!objects.has(`${expired}.pdf`)); assert(objects.has(`${uploadId}.pdf`), "Cleanup must preserve saved archives");
  const localForm = new FormData(); Object.entries(fields).forEach(([k, v]) => localForm.set(k, v)); localForm.set("file", new File([pdf], "Arsip.pdf", { type: "application/pdf" }));
  response = await api.POST(new Request("http://localhost", { method: "POST", body: localForm })); assert.equal(response.status, 201);
  const second = (await response.json()).document;
  assert.equal((await remove(doc, {})).status, 422); assert.equal((await remove(doc, { confirmed: false, updatedAt: doc.updatedAt })).status, 422);
  assert.equal((await remove(doc, { confirmed: true, updatedAt: "2000-01-01T00:00:00.000Z" })).status, 409);
  assert(objects.has(`${doc.id}.pdf`)); assert(db.prepare("SELECT id FROM service_archive_documents WHERE id = ?").get(doc.id));
  failWrite = true; assert.equal((await remove(doc)).status, 500); failWrite = false;
  assert(objects.has(`${doc.id}.pdf`)); assert(db.prepare("SELECT id FROM service_archive_documents WHERE id = ?").get(doc.id), "Transaction failure must retain the archive and file");
  allowed = false; assert.equal((await remove(doc)).status, 403); allowed = true;
  // The production adapter preserves Postgres timestamp text, including space
  // separators and +00 offsets, so its version must round-trip unchanged.
  doc.updatedAt = doc.updatedAt.replace("T", " ").replace("Z", "+00");
  db.prepare("UPDATE service_archive_documents SET updated_at = ? WHERE id = ?").run(doc.updatedAt, doc.id);
  const deleted = await remove(doc); assert.equal(deleted.status, 200); assert.equal((await deleted.json()).fileCleanupPending, false);
  assert(!objects.has(`${doc.id}.pdf`)); assert.equal(await service.getArchiveDownload(doc.id), null);
  assert(objects.has(`${second.id}.pdf`), "Deletion must preserve the other archive file");
  assert.equal((await remove(doc)).status, 404);
  await assert.rejects(() => readArchiveUpload(userId, doc.id), "Deleted archives must not be restorable through a stale upload id");
  failDelete = true; const queued = await remove(second); failDelete = false;
  assert.equal(queued.status, 200); assert.equal((await queued.json()).fileCleanupPending, true);
  assert(db.prepare("SELECT id FROM service_archive_uploads WHERE id = ?").get(second.id)); assert(objects.has(`${second.id}.pdf`));
  await prepare(8); assert(objects.has(`${second.id}.pdf`), "Cleanup tombstones must outlive issued upload tokens");
  db.prepare("UPDATE service_archive_uploads SET created_at = ? WHERE id = ?").run("2000-01-01T00:00:00.000Z", second.id);
  await prepare(8); assert(!objects.has(`${second.id}.pdf`), "Storage failure must be retried through the durable cleanup queue");
  await assert.rejects(() => service.saveArchiveDocument({ userId, metadata: fields, file: Buffer.concat([pdf, Buffer.from("x")]) }));
  cloud = false; assert.deepEqual(await (await prepare(max)).json(), { local: true }); cloud = true;
  allowed = false; assert.equal((await prepare(max)).status, 403); assert.equal((await api.POST(json({ ...fields, uploadId }))).status, 403); assert.equal((await downloads.GET(new Request("http://localhost"), { params: Promise.resolve({ id: doc.id }) })).status, 403);
  userId = null; assert.equal((await remove(second)).status, 401); assert.equal((await prepare(max)).status, 401); assert.equal((await api.GET()).status, 401);
  console.log("PASS Arsip Dinas: 10 MiB upload/save/Gemini, invalid-file rejection, authorization, expiry, retry, private download; explicit delete confirmation, stale-edit conflict, transactional rollback, scoped PDF deletion, inaccessible download after deletion and durable storage-failure cleanup.");
} finally { db.close(); }
