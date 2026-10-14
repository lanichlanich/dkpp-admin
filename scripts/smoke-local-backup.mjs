import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import ts from "typescript";
const require = createRequire(import.meta.url);
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Local backup must not call Google OAuth or Drive"); };
delete process.env.BACKUP_ADMIN_USERNAMES;
process.env.GOOGLE_DRIVE_BACKUP_ADMIN_USERNAMES = "admin1";
delete process.env.GOOGLE_DRIVE_CLIENT_ID; delete process.env.GOOGLE_DRIVE_CLIENT_SECRET; delete process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
const poName = "12345678-1234-1234-1234-123456789abc.docx";
const contents = new Map(["employee.pdf", "kak.docx", "rka.pdf", poName, "report.docx"].map(name => [name, Buffer.from(`Original bytes for ${name}`)]));
contents.set("orphan.pdf", randomBytes(5 * 1024 * 1024));
const snapshot = { tables: {
  app_roles: [{ id: "administrator", name: "Administrator", is_administrator: 1, menu_permissions: "[]" }],
  employees: [{ nip: "198001012005011001", name: "Pegawai Uji" }],
  users: [{ id: "admin", username: "admin1", password_hash: "restore-hash" }],
  employee_documents: [{ id: "employee", storage_name: "employee.pdf", original_file_name: "pegawai.pdf" }],
  kak_documents: [{ id: "kak", storage_name: "kak.docx", file_name: "kak.docx", source_storage_name: "rka.pdf", source_name: "rka.pdf", draft_json: JSON.stringify({ poDocument: { storageName: poName, fileName: "po.docx", fileSize: 20, templateSha256: "a".repeat(64) } }) }],
  wfh_reports: [{ id: "report" }],
}, storageObjects: [...contents.keys()].map(name => ({ name, metadata: { size: contents.get(name).length } })) };
function setup(user = { id: "admin", username: "admin1" }, failure = false) {
  const state = { snapshots: 0, downloads: [] }, cache = new Map();
  cache.set(path.resolve("src/lib/session.ts"), { exports: { getCurrentUser: async () => user ? { isAdministrator: true, menuPermissions: [], ...user } : null } });
  cache.set(path.resolve("src/lib/database.ts"), { exports: { createBackupSnapshot: async () => { state.snapshots++; return snapshot; } } });
  cache.set(path.resolve("src/lib/storage.ts"), { exports: { downloadStorageObject: async name => { state.downloads.push(name); if (failure) throw new Error("Unreadable file"); return contents.get(name); } } });
  function load(file) {
    const filename = path.resolve(file); if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename); cache.set(filename, mod); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = specifier => specifier === "server-only" ? {} : specifier.startsWith("@/") ? load(`src/${specifier.slice(2)}.ts`) : require(specifier);
    mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
    return mod.exports;
  }
  return { api: load("src/app/api/backups/local/route.ts"), backup: load("src/lib/local-backup.ts"), state };
}
function extract(bytes) {
  const tar = gunzipSync(bytes), files = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512); if (header.every(byte => byte === 0)) break;
    const text = (start, length) => header.subarray(start, start + length).toString("utf8").split("\0")[0];
    const name = [text(345, 155), text(0, 100)].filter(Boolean).join("/");
    assert(!name.split("/").includes("..")); assert(!files.has(name));
    assert.equal(header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0), Number.parseInt(text(148, 8).trim(), 8));
    const size = Number.parseInt(text(124, 12), 8); files.set(name, tar.subarray(offset + 512, offset + 512 + size)); offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}
const request = origin => new Request("https://app.test/api/backups/local", { method: "POST", headers: origin ? { origin } : {} });
try {
  for (const [user, status] of [[null, 401], [{ id: "guest", username: "guest" }, 403]]) {
    const fixture = setup(user); assert.equal((await fixture.api.POST(request())).status, status); assert.equal(fixture.state.snapshots, 0);
  }
  const crossOrigin = setup(); assert.equal((await crossOrigin.api.POST(request("https://other.test"))).status, 403); assert.equal(crossOrigin.state.snapshots, 0);
  const fixture = setup(); assert(fixture.backup.localBackupAllowed("ADMIN1"));
  const response = await fixture.api.POST(request("https://app.test")); assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-length"), null); assert.match(response.headers.get("content-disposition"), /backup-dkpp-admin-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.tar\.gz/);
  assert.equal((await fixture.api.POST(request())).status, 429);
  const chunks = [], reader = response.body.getReader();
  while (true) { const { done, value } = await reader.read(); if (done) break; assert(value.length <= 65536); chunks.push(value); }
  const bytes = Buffer.concat(chunks); assert(bytes.length > 4.5 * 1024 * 1024, "Exercise a backup above Vercel's buffered payload limit");
  assert.equal(bytes.length, Number(response.headers.get("x-backup-bytes"))); assert.equal(createHash("sha256").update(bytes).digest("hex"), response.headers.get("x-backup-sha256"));
  const files = extract(bytes), manifest = JSON.parse(files.get("manifest.json"));
  assert.equal(manifest.tableCount, 6); assert.equal(manifest.documentCount, 5); assert.equal(manifest.unlinkedStorageObjectCount, 1);
  assert.deepEqual(JSON.parse(files.get("Kepegawaian/database/employees.json")), snapshot.tables.employees);
  assert.deepEqual(JSON.parse(files.get("Sistem/database/users.json")), snapshot.tables.users);
  assert(![...files.keys()].some(name => /sessions|\.env/.test(name))); assert(files.has("PEMULIHAN.txt"));
  for (const entry of manifest.files) { assert.equal(files.get(entry.path).length, entry.size); assert.equal(createHash("sha256").update(files.get(entry.path)).digest("hex"), entry.sha256); }
  for (const entry of manifest.storageFiles) assert.deepEqual(files.get(entry.path), contents.get(entry.storageName), "Restore mapping must retain original bytes and Storage names");
  assert.deepEqual([...fixture.state.downloads].sort(), [...contents.keys()].sort());
  const again = await fixture.api.POST(request()); assert.equal(again.status, 200); await again.body.cancel();
  const afterCancel = await fixture.api.POST(request()); assert.equal(afterCancel.status, 200); await afterCancel.body.cancel();
  const failed = setup(undefined, true), oldError = console.error; console.error = () => {};
  try { assert.equal((await failed.api.POST(request())).status, 500); assert.equal((await failed.api.POST(request())).status, 500); } finally { console.error = oldError; }
  process.env.BACKUP_ADMIN_USERNAMES = "admin2"; assert(!fixture.backup.localBackupAllowed("admin1")); assert(fixture.backup.localBackupAllowed("admin2"));
  console.log("PASS local backup: >5 MB streamed archive, extraction/checksums, original database and all document bytes, restore mapping, no OAuth, admin/auth/origin checks, concurrency, cancellation and complete failure on missing files");
} finally { globalThis.fetch = originalFetch; }
