import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import Database from "better-sqlite3";
import ts from "typescript";
import PizZip from "pizzip";

const require = createRequire(import.meta.url);
const db = new Database(":memory:");
db.pragma("foreign_keys = ON");
db.exec("CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('test-user'); CREATE TABLE employees (nip TEXT PRIMARY KEY, name TEXT, status TEXT, position TEXT, unit TEXT)");
const schema = readFileSync("src/lib/db.ts", "utf8").match(/CREATE TABLE IF NOT EXISTS plt_assignments \([\s\S]*?WHERE closed_at IS NULL;/)[0];
db.exec(schema); db.exec(schema);
const nip = "199001012020121001", otherNip = "199001012020121002";
db.prepare("INSERT INTO employees VALUES (?, ?, 'Aktif', 'Pelaksana', 'Dinas')").run(nip, "Pegawai Contoh");
db.prepare("INSERT INTO employees VALUES (?, ?, 'Aktif', 'Pelaksana', 'Dinas')").run(otherNip, "Pegawai Kedua");
let signedIn = true, allowed = true;
let failWrites = false, failUpload = false;
const storedFiles = new Map();
const pdfBytes = Buffer.from("%PDF-1.4\nSynthetic SK Plt.\n%%EOF");
const cache = new Map();
const adapter = { prepare(sql) { const statement = db.prepare(sql); return {
  get: async (...values) => statement.get(...values), all: async (...values) => statement.all(...values), run: async (...values) => { if (failWrites && /INSERT INTO plt_assignments/.test(sql)) throw new Error("Simulated persistence failure"); return statement.run(...values); },
}; } };
const auth = {
  requireMenuAccess: async menu => { assert.equal(menu, "daftar-plt"); if (!signedIn || !allowed) throw new Error("Unauthorized"); return { id: "test-user" }; },
  checkApiAccess: async menus => { assert.deepEqual(menus, ["daftar-plt"]); return !signedIn ? Response.json({}, { status: 401 }) : !allowed ? Response.json({}, { status: 403 }) : null; },
};
function load(file) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); cache.set(filename, mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name === "next/cache") return { revalidatePath: () => {} };
    if (name === "@/lib/database") return { database: adapter };
    if (name === "@/lib/authorization") return auth;
    if (name === "@/lib/storage") return {
      isStorageConfigured: () => true,
      uploadStorageObject: async (name, bytes) => { if (failUpload) throw new Error("Simulated upload failure"); storedFiles.set(name, Buffer.from(bytes)); },
      deleteStorageObject: async name => { storedFiles.delete(name); },
      downloadStorageObject: async name => { if (!storedFiles.has(name)) throw new Error("Missing file"); return storedFiles.get(name); },
    };
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const dates = load("src/lib/plt-dates.ts"), service = load("src/lib/plt-assignments.ts");
const api = load("src/app/api/plt/route.ts"), rowApi = load("src/app/api/plt/[id]/route.ts");
const download = load("src/app/api/plt/[id]/download/route.ts");
const values = { employeeNip: nip, actingPosition: "Kepala Bidang Contoh", actingUnit: "Bidang Contoh", skNumber: "800/1/2026", startDate: "2026-10-27", notes: "Data sintetis", previousId: "" };
const request = (input, method = "POST", file = new File([pdfBytes], "SK-Plt.pdf", { type: "application/pdf" })) => {
  if (input.action) return new Request("http://localhost/api/plt", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) form.set(key, value);
  if (file) form.set("skFile", file);
  return new Request("http://localhost/api/plt", { method, body: form });
};
const context = id => ({ params: Promise.resolve({ id }) });
try {
  for (const [start, end] of [["2026-10-27", "2027-01-26"], ["2026-01-31", "2026-04-29"], ["2023-11-30", "2024-02-28"], ["2026-11-30", "2027-02-27"], ["2024-02-29", "2024-05-28"], ["2026-12-31", "2027-03-30"]]) assert.equal(dates.pltEndDate(start), end);
  assert(!dates.validPltDate("2026-02-29")); assert(!dates.validPltDate("2026-04-31")); assert(dates.validPltDate("2024-02-29"));
  assert.equal(dates.jakartaToday(new Date("2026-10-26T16:59:59Z")), "2026-10-26");
  assert.equal(dates.jakartaToday(new Date("2026-10-26T17:00:00Z")), "2026-10-27");
  let response = await api.POST(request({ ...values, endDate: "2099-01-01", employeeName: "Forged" }));
  assert.equal(response.status, 201); const { id } = await response.json();
  let row = (await service.getPltAssignments())[0];
  assert.equal(row.employeeName, "Pegawai Contoh"); assert.equal(row.endDate, "2027-01-26");
  assert.equal(row.fileName, "SK-Plt.pdf"); assert.equal(row.fileSize, pdfBytes.length);
  response = await download.GET(new Request("http://localhost"), context(id));
  assert.equal(response.status, 200); assert(Buffer.from(await response.arrayBuffer()).equals(pdfBytes));
  assert.match(response.headers.get("content-disposition"), /attachment/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const oldStorageName = db.prepare("SELECT storage_name FROM plt_assignments WHERE id = ?").get(id).storage_name;
  for (const [day, expected] of [["2026-10-26", "upcoming"], ["2027-01-11", "active"], ["2027-01-12", "expiring"], ["2027-01-26", "expiring"], ["2027-01-27", "expired"]]) assert.equal(dates.pltStatus(row, day).status, expected);
  assert.equal(dates.pltTimeLabel(row, "2027-01-26"), "Berakhir hari ini");
  assert.equal((await api.POST(request(values))).status, 409);
  assert.equal((await api.POST(request({ ...values, employeeNip: otherNip, startDate: "2026-11-01" }))).status, 409);
  assert.equal((await api.POST(request({ ...values, employeeNip: "000000000000000000", actingUnit: "Lain" }))).status, 400);
  assert.equal((await api.POST(request({ ...values, startDate: "2026-02-30" }))).status, 400);
  assert.equal((await api.POST(new Request("http://localhost", { method: "POST", body: "broken" }))).status, 400);
  response = await rowApi.PATCH(request({ ...values, skNumber: "800/2/2026" }, "PATCH", null), context(id)); assert.equal(response.status, 200);
  assert.equal(db.prepare("SELECT sk_number FROM plt_assignments WHERE id = ?").get(id).sk_number, "800/2/2026");
  assert(storedFiles.has(oldStorageName), "Metadata edit must retain the original SK");
  response = await rowApi.PATCH(request(values, "PATCH", new File([pdfBytes], "SK baru.pdf")), context(id));
  assert.equal(response.status, 200); assert(!storedFiles.has(oldStorageName)); assert.equal(storedFiles.size, 1);
  for (const file of [new File(["plain text"], "wrong.pdf"), new File([pdfBytes], "bad.exe"), new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.pdf"), new File([], "empty.pdf")]) {
    response = await api.POST(request({ ...values, actingUnit: "Unit berbeda" }, "POST", file));
    assert([400, 413].includes(response.status));
  }
  assert.equal((await api.POST(request({ ...values, actingUnit: "Unit berbeda" }, "POST", null))).status, 400);
  assert.equal((await api.POST(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: " ".repeat(3 * 1024 * 1024) }))).status, 413);
  const beforeFailure = storedFiles.size;
  const realConsoleError = console.error; console.error = () => {};
  try {
    failWrites = true; assert.equal((await api.POST(request({ ...values, actingUnit: "Failure Unit" }))).status, 500); failWrites = false;
    assert.equal(storedFiles.size, beforeFailure, "Failed database writes must remove the newly uploaded SK");
    failUpload = true; assert.equal((await api.POST(request({ ...values, actingUnit: "Upload Failure" }))).status, 500); failUpload = false;
    assert.equal(db.prepare("SELECT count(*) n FROM plt_assignments").get().n, 1);
  } finally { console.error = realConsoleError; failWrites = false; failUpload = false; }
  const docx = new PizZip(); docx.file("[Content_Types].xml", "<Types/>"); docx.file("word/document.xml", "<document/>");
  const fileService = load("src/lib/plt-files.ts");
  const docxFile = await fileService.storePltFile(new File([docx.generate({ type: "nodebuffer" })], "SK.docx"));
  assert.equal(docxFile.mimeType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  await fileService.removePltFile(docxFile);
  const extension = { ...values, skNumber: "800/3/2027", startDate: "2027-01-27", previousId: id };
  assert.equal((await api.POST(request({ ...extension, startDate: "2027-01-28" }))).status, 400);
  assert.equal((await api.POST(request({ ...extension, employeeNip: otherNip }))).status, 400);
  response = await api.POST(request(extension)); assert.equal(response.status, 201); const nextId = (await response.json()).id;
  assert.equal((await api.POST(request(extension))).status, 409);
  assert.equal((await rowApi.PATCH(request(values, "PATCH"), context(id))).status, 409);
  assert.equal((await rowApi.DELETE(new Request("http://localhost"), context(id))).status, 409);
  row = (await service.getPltAssignments()).find(item => item.id === id);
  assert.equal(dates.pltStatus(row, "2027-01-27").status, "renewed");
  assert.equal((await rowApi.PATCH(request({ ...extension, previousId: "" }, "PATCH"), context(nextId))).status, 400);
  assert.equal((await rowApi.PATCH(request({ action: "close" }, "PATCH"), context(nextId))).status, 200);
  const closed = (await service.getPltAssignments()).find(item => item.id === nextId); assert.equal(dates.pltStatus(closed, "2027-06-01").status, "closed");
  assert.equal((await api.POST(request({ ...extension, previousId: nextId, startDate: dates.nextPltDay(closed.endDate) }))).status, 409);
  assert.equal((await rowApi.DELETE(new Request("http://localhost"), context(nextId))).status, 200);
  assert.equal((await rowApi.DELETE(new Request("http://localhost"), context(id))).status, 200);
  assert.equal((await rowApi.DELETE(new Request("http://localhost"), context(id))).status, 404);
  assert.equal((await download.GET(new Request("http://localhost"), context(id))).status, 404);
  assert.equal(storedFiles.size, 0, "Deleting periods must remove their SK documents");
  assert.equal((await rowApi.DELETE(new Request("http://localhost"), context("bad-id"))).status, 400);
  db.prepare("UPDATE employees SET status = 'Mutasi' WHERE nip = ?").run(nip);
  assert.equal((await api.POST(request(values))).status, 400);
  allowed = false;
  assert.equal((await api.GET()).status, 403); assert.equal((await api.POST(request(values))).status, 403);
  assert.equal((await download.GET(new Request("http://localhost"), context(id))).status, 403);
  assert.equal((await rowApi.PATCH(request(values, "PATCH"), context(id))).status, 403);
  await assert.rejects(() => service.getPltAssignments(), /Unauthorized/);
  await assert.rejects(() => service.savePltAssignment(values), /Unauthorized/);
  signedIn = false;
  assert.equal((await api.GET()).status, 401); assert.equal((await api.POST(request(values))).status, 401);
  assert.equal((await download.GET(new Request("http://localhost"), context(id))).status, 401);
  assert.equal((await rowApi.DELETE(new Request("http://localhost"), context(id))).status, 401);
  assert.equal(db.prepare("SELECT count(*) AS count FROM plt_assignments").get().count, 0);
  const access = load("src/lib/access-control.ts");
  assert(access.canAccessPath({ isAdministrator: true, menuPermissions: [] }, "/dashboard/daftar-plt"));
  assert(!access.canAccessPath({ isAdministrator: false, menuPermissions: ["pegawai"] }, "/dashboard/daftar-plt"));
  assert(access.canAccessPath({ isAdministrator: false, menuPermissions: ["daftar-plt"] }, "/dashboard/daftar-plt"));
  console.log("PASS Plt.: calendar months/leap years/WIB midnight, H-14/expiry, persistence/edit, server identity, overlap prevention, renewal/history, close/delete, SK upload/replacement/authenticated bytes, 2 MB and signatures, rollback cleanup, session and menu authorization.");
} finally { db.close(); }
