import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import ts from "typescript";

const require = createRequire(import.meta.url);
const poName = "12345678-1234-1234-1234-123456789abc.docx";
const sourceNames = ["employee.pdf", "kak.docx", "rka.pdf", poName, "report-1.docx", "orphan.pdf"];
const fixtureBytes = name => Buffer.from(`Fixture content: ${name}`);
const snapshot = {
  tables: {
    employees: [{ id: "employee-1", name: "Pegawai Contoh" }],
    employee_documents: [{ id: "doc-1", storage_name: "employee.pdf", original_file_name: "scan.pdf" }],
    kak_documents: [{
      id: "kak-1", storage_name: "kak.docx", file_name: "KAK.docx",
      source_storage_name: "rka.pdf", source_name: "RKA.pdf", source_file_size: 12,
      draft_json: JSON.stringify({ poDocument: {
        storageName: poName, fileName: "PO.docx", fileSize: 12, templateSha256: "a".repeat(64),
      } }),
    }],
    wfh_reports: [{ id: "report-1" }],
    users: [{ id: "user-1", username: "admin1" }],
  },
  storageObjects: sourceNames.map(name => ({ name, metadata: { size: fixtureBytes(name).length } })),
};

process.env.GOOGLE_DRIVE_CLIENT_ID = "fixture-client";
process.env.GOOGLE_DRIVE_CLIENT_SECRET = "fixture-secret";
process.env.GOOGLE_DRIVE_REFRESH_TOKEN = "fixture-refresh";
process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID = "fixture-root";
process.env.GOOGLE_DRIVE_BACKUP_ADMIN_USERNAMES = " admin1 , admin2 ";
delete process.env.GOOGLE_DRIVE_BACKUP_ENCRYPTION_KEY;

function setup({ tokenError, tokenStatus = 400, permissions = [{ type: "user" }], canWrite = true, malformedError = false, username = "admin1" } = {}) {
  const state = { snapshots: 0, downloads: [], folders: [], uploads: [], tokenCalls: 0 };
  const cache = new Map();
  cache.set(path.resolve("src/lib/session.ts"), { exports: { requireUser: async () => ({ username }) } });
  cache.set(path.resolve("src/lib/database.ts"), { exports: {
    createBackupSnapshot: async () => { state.snapshots++; return snapshot; },
  } });
  cache.set(path.resolve("src/lib/storage.ts"), { exports: {
    downloadStorageObject: async name => { state.downloads.push(name); return fixtureBytes(name); },
  } });
  function load(file) {
    const filename = path.resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = specifier => specifier === "server-only" ? {} : specifier.startsWith("@/") ? load(`src/${specifier.slice(2)}.ts`) : require(specifier);
    mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, filename);
    return mod.exports;
  }
  globalThis.fetch = async (url, init = {}) => {
    const address = String(url);
    if (address === "https://oauth2.googleapis.com/token") {
      state.tokenCalls++;
      const params = new URLSearchParams(init.body);
      assert.equal(params.get("grant_type"), "refresh_token");
      assert.equal(params.get("client_id"), "fixture-client");
      assert.equal(params.get("client_secret"), "fixture-secret");
      assert.equal(params.get("refresh_token"), "fixture-refresh");
      if (malformedError) return new Response("not-json: private-response", { status: tokenStatus });
      if (tokenError) return Response.json({ error: tokenError, error_description: "private-response fixture-secret fixture-refresh" }, { status: tokenStatus });
      return Response.json({ access_token: "fixture-access", expires_in: 3600 });
    }
    assert.equal(init.headers.authorization, "Bearer fixture-access");
    if (address.startsWith("https://www.googleapis.com/drive/v3/files/fixture-root?")) {
      assert.equal(state.snapshots, 0, "Validate OAuth/folder before reading the snapshot");
      return Response.json({ mimeType: "application/vnd.google-apps.folder", capabilities: { canAddChildren: canWrite }, permissions });
    }
    if (address.startsWith("https://www.googleapis.com/drive/v3/files?")) {
      assert.equal(init.method, "POST");
      const body = JSON.parse(init.body), id = `folder-${state.folders.length + 1}`;
      state.folders.push({ id, ...body });
      return Response.json({ id, webViewLink: `https://drive.google.com/drive/folders/${id}` });
    }
    if (address.startsWith("https://www.googleapis.com/upload/drive/v3/files?")) {
      const body = JSON.parse(init.body);
      assert.equal(body.mimeType, "application/gzip");
      assert.equal(init.headers["x-upload-content-type"], "application/gzip");
      state.uploads.push(body);
      return Response.json({}, { headers: { location: `https://upload.test/${state.uploads.length - 1}` } });
    }
    if (address.startsWith("https://upload.test/")) {
      const index = Number(address.split("/").at(-1));
      assert.equal(init.method, "PUT");
      assert.equal(init.headers["content-type"], "application/gzip");
      state.uploads[index].bytes = Buffer.from(init.body);
      assert.equal(Number(init.headers["content-length"]), state.uploads[index].bytes.length);
      return Response.json({});
    }
    throw new Error(`Unexpected fixture request: ${address}`);
  };
  return { state, api: load("src/lib/google-drive-backup.ts"), actions: load("src/actions/backups.ts") };
}

function extract(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0x1f8b, "Archive must be ordinary gzip, not encrypted DKPPBK01");
  const tar = gunzipSync(bytes), files = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const text = (start, length) => header.subarray(start, start + length).toString("utf8").split("\0")[0];
    assert.equal(text(257, 5), "ustar");
    const expectedChecksum = Number.parseInt(text(148, 8).trim(), 8);
    const checksum = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    assert.equal(checksum, expectedChecksum, "Tar header checksum must be valid");
    const name = [text(345, 155), text(0, 100)].filter(Boolean).join("/");
    const size = Number.parseInt(text(124, 12), 8);
    files.set(name, tar.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

const originalFetch = globalThis.fetch;
try {
  for (const [tokenError, pattern] of [["invalid_client", /invalid_client/], ["invalid_grant", /invalid_grant/], ["deleted_client", /tidak tersedia/], ["unauthorized_client", /tidak diizinkan/], ["unknown-private-response", /HTTP 400/]]) {
    const { api, state } = setup({ tokenError });
    await assert.rejects(api.createGoogleDriveBackup(), error => {
      assert.match(error.message, pattern);
      assert(!/fixture-secret|fixture-refresh|private-response/.test(error.message), "Never expose Google's raw response or credentials");
      return true;
    });
    assert.equal(state.snapshots, 0); assert.equal(state.downloads.length, 0); assert.equal(state.folders.length, 0);
  }
  const malformed = setup({ malformedError: true, tokenStatus: 503 });
  await assert.rejects(malformed.api.createGoogleDriveBackup(), /HTTP 503/);
  assert.equal(malformed.state.snapshots, 0);
  for (const permissions of [[{ type: "anyone", role: "reader" }], [{ type: "domain" }], null]) {
    const fixture = setup({ permissions });
    await assert.rejects(fixture.api.createGoogleDriveBackup(), /Dibatasi|tidak dapat diperiksa/);
    assert.equal(fixture.state.snapshots, 0); assert.equal(fixture.state.folders.length, 0);
  }
  const readOnly = setup({ canWrite: false });
  await assert.rejects(readOnly.api.createGoogleDriveBackup(), /akses tulis/);
  assert.equal(readOnly.state.snapshots, 0);

  const unauthorized = setup({ username: "guest" });
  assert.equal((await unauthorized.actions.checkGoogleDriveBackupAction()).status, "error");
  assert.equal((await unauthorized.actions.runGoogleDriveBackupAction()).status, "error");
  assert.equal(unauthorized.state.tokenCalls, 0); assert.equal(unauthorized.state.snapshots, 0);
  const connection = setup();
  const connectionResult = await connection.actions.checkGoogleDriveBackupAction();
  assert.equal(connectionResult.status, "success"); assert.equal(connectionResult.backupId, undefined);
  assert.equal(connection.state.snapshots, 0); assert.equal(connection.state.downloads.length, 0); assert.equal(connection.state.folders.length, 0);

  const { api, actions, state } = setup();
  assert(api.googleDriveBackupReady(), "Encryption key must not be required");
  assert(api.googleDriveBackupAllowed("ADMIN1")); assert(!api.googleDriveBackupAllowed("guest"));
  const result = await actions.runGoogleDriveBackupAction();
  assert.equal(result.status, "success"); assert.match(result.message, /\.tar\.gz/);
  assert.equal(state.snapshots, 1);
  assert.equal(result.archiveCount, 5); assert.equal(result.tableCount, 5);
  assert.equal(result.documentCount, 5); assert.equal(result.unlinkedStorageObjectCount, 1);
  assert.equal(state.tokenCalls, 1, "Reuse the access token across folder creation and uploads");
  assert.deepEqual([...state.downloads].sort(), [...sourceNames].sort());
  assert.equal(state.folders.length, 6); assert.equal(state.uploads.length, 5);
  assert.deepEqual(state.folders[0].parents, ["fixture-root"]);
  assert.match(state.folders[0].name, /^Backup \d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
  const categories = new Set(["Kepegawaian", "Persuratan", "Umum", "Perencanaan", "Sistem"]), archives = new Map();
  for (const upload of state.uploads) {
    const folder = state.folders.find(item => item.id === upload.parents[0]);
    assert(categories.delete(folder.name));
    assert.equal(upload.name, `backup-${folder.name.toLowerCase()}.tar.gz`);
    archives.set(folder.name, extract(upload.bytes));
  }
  assert.equal(categories.size, 0);
  assert.deepEqual(JSON.parse(archives.get("Kepegawaian").get("database/employees.json")), snapshot.tables.employees);
  assert.deepEqual(archives.get("Kepegawaian").get("files/employee_documents/record-doc-1.pdf"), fixtureBytes("employee.pdf"));
  const planning = archives.get("Perencanaan");
  for (const [suffix, extension, source] of [["", "docx", "kak.docx"], ["-rka", "pdf", "rka.pdf"], ["-po", "docx", poName]]) {
    assert.deepEqual(planning.get(`files/kak_documents/record-kak-1${suffix}.${extension}`), fixtureBytes(source));
  }
  assert.deepEqual(archives.get("Umum").get("files/wfh_reports/record-report-1.docx"), fixtureBytes("report-1.docx"));
  const system = archives.get("Sistem"), orphan = JSON.parse(system.get("database/unlinked-storage-index.json"))[0];
  assert.equal(orphan.storageName, "orphan.pdf");
  assert.deepEqual(system.get(orphan.path), fixtureBytes("orphan.pdf"));
  console.log("PASS Google Drive backup: plain gzip/tar extraction, 5 categories, database snapshots, KAK/RKA/PO, WFH and orphan bytes; OAuth diagnostics redact secrets and fail before snapshot; private writable folder enforced; encryption key unnecessary.");
} finally {
  globalThis.fetch = originalFetch;
}
