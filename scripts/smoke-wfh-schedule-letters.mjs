import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import Database from "better-sqlite3";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import PDFKit from "pdfkit";
import ts from "typescript";

const require = createRequire(import.meta.url), cache = new Map(), db = new Database(":memory:");
db.pragma("foreign_keys=ON");
db.exec("CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES('letter-test'); CREATE TABLE wfh_schedule_months(period TEXT PRIMARY KEY); INSERT INTO wfh_schedule_months VALUES('2026-10'),('2026-11');");
db.exec(readFileSync("src/lib/db.ts", "utf8").match(/CREATE TABLE IF NOT EXISTS wfh_schedule_letters \([\s\S]*?\);/)[0]);
db.exec("CREATE TABLE wfh_schedule_entries(period TEXT,employee_nip TEXT,employee_name TEXT,position TEXT,unit TEXT,sort_order INTEGER,friday_date TEXT,status TEXT)");
const objects = new Map(), invalidations = [], generated = [];
let access = "allowed", failInsert = false, failUpload = false, queries = 0;
const adapter = { prepare(sql) {
  queries++; const statement = db.prepare(sql);
  return { get: async (...v) => statement.get(...v), all: async (...v) => statement.all(...v), run: async (...v) => {
    if (failInsert && sql.startsWith("INSERT INTO wfh_schedule_letters")) throw Error("DB unavailable");
    return statement.run(...v);
  } };
} };
function load(file) {
  const filename = path.resolve(file); if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); cache.set(filename, mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name === "@/lib/database") return { database: adapter };
    if (name === "next/cache") return { revalidatePath: value => invalidations.push(value) };
    if (name === "@/lib/session") return { getCurrentUser: async () => access === "anonymous" ? null : { id: "letter-test" } };
    if (name === "@/lib/authorization") return { checkApiAccess: async menus => {
      assert.deepEqual(menus, ["laporan-pegawai-wfh-wfo"]);
      return access === "allowed" ? null : Response.json({}, { status: access === "anonymous" ? 401 : 403 });
    } };
    if (name === "@/lib/storage") return {
      isStorageConfigured: () => true,
      uploadStorageObject: async (name, bytes, type) => { assert.equal(type, "application/pdf"); objects.set(name, Buffer.from(bytes)); if (failUpload) throw Error("Storage unavailable"); },
      downloadStorageObject: async name => Buffer.from(objects.get(name)),
      deleteStorageObject: async name => { objects.delete(name); },
    };
    if (name.endsWith(".json")) return require(path.resolve(name.replace(/^@\//, "src/")));
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const exportsApi = load("src/lib/wfh-schedule-export.ts"), actualPdf = exportsApi.createSchedulePdf;
exportsApi.createSchedulePdf = async (period, entries) => { generated.push({ period, entries: structuredClone(entries) }); return actualPdf(period, entries); };
const api = load("src/lib/wfh-schedule-letters.ts"), { fridayDates } = load("src/lib/wfh-schedule.ts");
const upload = load("src/app/api/wfh-schedule/[period]/letter/route.ts");
const download = load("src/app/api/wfh-schedule/[period]/letter/[id]/[kind]/route.ts");
const source = await PDFDocument.create(), font = await source.embedFont(StandardFonts.Helvetica);
for (const [index, size] of [[595.28, 841.89], [841.89, 595.28]].entries()) {
  const page = source.addPage(size);
  page.drawText(`SIGNED TASK LETTER - TEST PAGE ${index + 1}`, { x: 48, y: size[1] - 70, size: 17, font });
  page.drawText("WFH/WFO - November 2026", { x: 48, y: size[1] - 110, size: 12, font });
  page.drawRectangle({ x: 50, y: 120, width: 220, height: 75, borderColor: rgb(0, 0.3, 0.7), borderWidth: 2 });
  page.drawText("SIGNED - TEST ONLY", { x: 65, y: 148, size: 14, color: rgb(0, 0.3, 0.7), font });
}
const signatureAppearance = source.getForm().createTextField("signed-appearance-test");
signatureAppearance.setText("TANDA TANGAN UJI");
signatureAppearance.addToPage(source.getPage(0), { x: 50, y: 230, width: 220, height: 30 });
signatureAppearance.setFontSize(12);
signatureAppearance.enableReadOnly(); source.getForm().updateFieldAppearances(font);
const original = Buffer.from(await source.save()), originalCopy = Buffer.from(original);
const context = (period, id, kind) => ({ params: Promise.resolve({ period, id, kind }) });
const request = (bytes = original, name = "surat-ttd.pdf") => { const form = new FormData(); form.set("file", new File([bytes], name, { type: "application/pdf" })); return new Request("http://test/upload", { method: "POST", body: form }); };
try {
  for (const mode of ["anonymous", "denied"]) {
    access = mode; const before = queries;
    assert.equal((await upload.POST(request(), context("2026-11"))).status, mode === "anonymous" ? 401 : 403);
    assert.equal((await download.GET(new Request("http://test"), context("2026-11", "invalid", "original"))).status, mode === "anonymous" ? 401 : 403);
    assert.equal(queries, before, "Authorization must precede database/storage access");
  }
  access = "allowed";
  for (const [period, bytes, status] of [["2026-13", original, 400], ["2027-01", original, 404], ["2026-11", Buffer.from("not PDF"), 422], ["2026-11", Buffer.from("%PDF-broken"), 422], ["2026-11", Buffer.alloc(2 * 1024 * 1024 + 1), 413]])
    assert.equal((await upload.POST(request(bytes), context(period))).status, status);
  const noFile = new FormData();
  assert.equal((await upload.POST(new Request("http://test", { method: "POST", body: noFile }), context("2026-11"))).status, 400);
  const encrypted = new PDFKit({ userPassword: "test-password", ownerPassword: "owner-password" }), chunks = [];
  const encryptedBytes = new Promise(resolve => { encrypted.on("data", chunk => chunks.push(chunk)); encrypted.on("end", () => resolve(Buffer.concat(chunks))); });
  encrypted.text("Password protected fixture"); encrypted.end();
  await assert.rejects(api.saveScheduleLetter("2026-11", "letter-test", "encrypted.pdf", await encryptedBytes), /kata sandi/);
  assert.equal(objects.size, 0);
  failInsert = true; await assert.rejects(api.saveScheduleLetter("2026-11", "letter-test", "rollback.pdf", original), /DB unavailable/); failInsert = false;
  assert.equal(objects.size, 0, "Failed metadata insert cleans private object");
  failUpload = true; await assert.rejects(api.saveScheduleLetter("2026-11", "letter-test", "storage-error.pdf", original), /Storage unavailable/); failUpload = false;
  assert.equal(objects.size, 0, "Uncertain upload failure cleans its unique object");
  const response = await upload.POST(request(), context("2026-11")); assert.equal(response.status, 201);
  const { letter } = await response.json(); assert.equal(letter.pageCount, 2);
  await api.saveScheduleLetter("2026-10", "letter-test", "october.pdf", original);
  await api.saveScheduleLetter("2026-11", "letter-test", "new-version.pdf", original);
  assert.equal((await api.getScheduleLetters("2026-11")).length, 2, "Upload preserves previous originals");
  assert.equal((await api.getScheduleLetters("2026-10")).length, 1);
  assert.equal(await api.readScheduleLetter("2026-10", letter.id), null, "A letter cannot be downloaded under another month");
  assert.equal(await api.readScheduleLetter("2026-11", "../letter"), null);
  assert.deepEqual(await api.readScheduleLetter("2026-11", letter.id), originalCopy);
  const originalDownload = await download.GET(new Request("http://test"), context("2026-11", letter.id, "original"));
  assert.equal(originalDownload.status, 200); assert.deepEqual(Buffer.from(await originalDownload.arrayBuffer()), originalCopy);
  assert.equal(originalDownload.headers.get("cache-control"), "private, no-store");
  assert.equal((await download.GET(new Request("http://test"), context("2026-10", letter.id, "original"))).status, 404);
  assert.equal((await download.GET(new Request("http://test"), context("2026-11", letter.id, "invalid"))).status, 400);
  let novemberCombined;
  for (const [period, people] of [["2026-11", 64], ["2026-10", 2]]) {
    for (let person = 0; person < people; person++) for (const [i, date] of fridayDates(period).entries())
      db.prepare("INSERT INTO wfh_schedule_entries VALUES(?,?,?,?,?,?,?,?)").run(period, String(199001012020121001n + BigInt(person)), `Pegawai Uji ${person + 1}`, "Pelaksana", "Unit Uji", person, date, i % 2 ? "WFO" : "WFH");
    const id = (await api.getScheduleLetters(period))[0].id;
    const mergedResponse = await download.GET(new Request("http://test"), context(period, id, "combined")); assert.equal(mergedResponse.status, 200);
    const bytes = Buffer.from(await mergedResponse.arrayBuffer()), merged = await PDFDocument.load(bytes);
    const attachment = await PDFDocument.load(await actualPdf(period, generated.at(-1).entries));
    assert.equal(generated.at(-1).period, period); assert.equal(generated.at(-1).entries.length, people * fridayDates(period).length);
    assert.equal(merged.getPageCount(), source.getPageCount() + attachment.getPageCount());
    for (let i = 0; i < 2; i++) assert.deepEqual(merged.getPage(i).getSize(), source.getPage(i).getSize());
    assert.equal(merged.getPage(2).getWidth(), attachment.getPage(0).getWidth());
    if (period === "2026-11") novemberCombined = bytes;
  }
  db.prepare("UPDATE wfh_schedule_entries SET status='WFO' WHERE period='2026-11'").run();
  await download.GET(new Request("http://test"), context("2026-11", letter.id, "combined"));
  assert(generated.at(-1).entries.every(entry => entry.status === "WFO"), "Combined download reads latest schedule");
  assert.deepEqual(original, originalCopy, "Merging must never rewrite original signed bytes");
  assert(invalidations.includes("/dashboard/laporan-pegawai-wfh-wfo"));
  mkdirSync(".tmp/wfh-schedule-letters", { recursive: true });
  writeFileSync(".tmp/wfh-schedule-letters/letter.pdf", original);
  writeFileSync(".tmp/wfh-schedule-letters/combined.pdf", novemberCombined);
  console.log("PASS signed WFH/WFO letters: access control, PDF/size/encryption validation, private persistence, rollback cleanup, original byte preservation, month isolation, version history, latest roster, 4/5 Fridays, page order/dimensions and multi-page attachment.");
} finally { db.close(); }
