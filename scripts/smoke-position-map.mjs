import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import Database from "better-sqlite3";
import PizZip from "pizzip";

const require = createRequire(import.meta.url), cache = new Map(), db = new Database(":memory:");
db.pragma("foreign_keys = ON");
db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES('tester');
  CREATE TABLE employees(nip TEXT PRIMARY KEY,name TEXT,position TEXT,position_type TEXT,echelon TEXT,unit TEXT,asn_type TEXT,rank TEXT,status TEXT,job_position_id TEXT);
  CREATE TABLE job_positions(id TEXT PRIMARY KEY,unit TEXT,organization_unit_id TEXT);
  CREATE TABLE organization_units(id TEXT PRIMARY KEY,name TEXT);`);
db.exec("CREATE TABLE plt_assignments(id TEXT PRIMARY KEY,employee_nip TEXT,acting_position TEXT,start_date TEXT,end_date TEXT,closed_at TEXT,previous_id TEXT)");
db.exec(readFileSync("src/lib/db.ts", "utf8").match(/CREATE TABLE IF NOT EXISTS position_map_plans \([\s\S]*?\);/)[0]);
let actor = null, reads = 0, invalidations = 0;
function load(file) {
  const filename = path.resolve(file);
  if (filename.endsWith(".json")) return JSON.parse(readFileSync(filename, "utf8"));
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); cache.set(filename, mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name === "next/navigation") return { redirect: () => { throw Error("Access denied"); } };
    if (name === "next/cache") return { revalidatePath: () => { invalidations++; } };
    if (name === "@/lib/session") return { getCurrentUser: async () => actor, requireUser: async () => { if (!actor) throw Error("Unauthenticated"); return actor; } };
    if (name === "@/lib/database") return { database: { prepare(sql) { return { get: (...values) => { reads++; return db.prepare(sql).get(...values); }, all: (...values) => { reads++; return db.prepare(sql).all(...values); }, run: (...values) => db.prepare(sql).run(...values) }; } } };
    if (name === "@/lib/plt-dates") return { jakartaToday: () => "2026-11-18" };
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}${name.endsWith(".json") ? "" : ".ts"}`);
    return require(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, filename);
  return mod.exports;
}
try {
  const model = load("src/lib/position-map-model.ts"), store = load("src/lib/position-map.ts");
  const { createPositionMapDocx } = load("src/lib/position-map-docx.ts");
  const api = load("src/app/api/position-map/[year]/route.ts"), download = load("src/app/api/position-map/[year]/docx/route.ts");
  const root = model.positionMapCatalog.find(p => p.name.startsWith("KEPALA DINAS"));
  const employee = { nip: "197801011997031003", name: "Uji", position: root.name, positionType: "JS", echelon: "II", unit: root.unit, asnType: "PNS", rank: "IV/b", status: "Aktif" };
  const insert = db.prepare("INSERT INTO employees(nip,name,position,position_type,echelon,unit,asn_type,rank,status) VALUES(?,?,?,?,?,?,?,?,?)");
  for (const e of [employee, { ...employee, nip: "197901011999031002", status: "Pensiun" }]) insert.run(e.nip,e.name,e.position,e.positionType,e.echelon,e.unit,e.asnType,e.rank,e.status);
  const staff = model.currentPositionMapStaff([employee, { ...employee, nip: "inactive", status: "Pensiun" }], "2026-11-18");
  assert.equal(staff.counts[root.id], 1); assert.equal(staff.active, 1);
  const plan = model.defaultPositionMapPlan(staff.counts);
  assert.equal(model.positionMapCatalog.length, 180); assert.equal(Object.keys(plan.positions).length, 180);
  assert(model.positionMapPlanSchema.safeParse(plan).success);
  const pages = model.buildPositionMapPages(plan, 2026);
  assert.equal(pages.length, 5);
  const ids = pages.flatMap(p => p.tables.flatMap(t => t.roleIds));
  assert.equal(ids.length, 180); assert.equal(new Set(ids).size, 180);
  assert.deepEqual(new Set(ids), model.positionMapIds);
  for (const page of pages) for (const table of page.tables) {
    assert(table.x >= 0 && table.x + table.width < page.width);
    assert(table.y >= 0 && table.y + table.heights.reduce((n,h) => n+h,0) < page.height - 35, `${page.title}: table must fit`);
    assert.equal(table.heights.length, table.rows.length);
  }
  const mutated = structuredClone(plan); mutated.positions[root.id] = { required: 2, staffed: 4 };
  const summary = model.positionMapSummary(mutated); assert.equal(summary.balance, summary.staffed - summary.required); assert(summary.shortage < 0); assert(summary.surplus > 0);
  for (const value of [-1, 1.5, 1000, "1", null]) {
    const invalid = structuredClone(plan); invalid.positions[root.id].required = value; assert(!model.positionMapPlanSchema.safeParse(invalid).success);
  }
  const missing = structuredClone(plan); delete missing.positions[root.id]; assert(!model.positionMapPlanSchema.safeParse(missing).success);
  assert(!model.positionMapPlanSchema.safeParse({ positions: { ...plan.positions, unknown: { required: 1, staffed: 2 } } }).success);
  const context = year => ({ params: Promise.resolve({ year: String(year) }) });
  const request = (body, origin = "http://localhost") => new Request("http://localhost/api/position-map/2026", { method: "PUT", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
  assert.equal((await api.GET(new Request("http://localhost"), context(2026))).status, 401);
  actor = { id: "tester", isAdministrator: false, menuPermissions: ["pegawai"] };
  assert.equal((await api.PUT(request({ plan, revision: 0 }), context(2026))).status, 403);
  assert.equal((await download.GET(new Request("http://localhost"), context(2026))).status, 403);
  assert.equal(reads, 0);
  actor = { id: "tester", isAdministrator: false, menuPermissions: ["peta-jabatan"] };
  let response = await api.GET(new Request("http://localhost"), context(2026)); assert.equal(response.status, 200);
  let state = await response.json(); assert.equal(state.record.revision, 0); assert.equal(state.record.plan.positions[root.id].staffed, 1);
  assert.equal((await api.PUT(request({ plan, revision: 0 }, "https://other.test"), context(2026))).status, 403);
  const proxyRequest = new Request("http://localhost/api/position-map/2026", { method: "PUT", headers: {
    origin: "https://dkpp-admin.vercel.app", host: "dkpp-admin.vercel.app", "x-forwarded-proto": "https", "content-type": "application/json",
  }, body: JSON.stringify({ plan, revision: -1 }) });
  assert.equal((await api.PUT(proxyRequest, context(2026))).status, 422, "Valid proxy origin must reach payload validation");
  assert.equal((await api.PUT(request({ plan, revision: 0 }), context(1900))).status, 422);
  response = await api.PUT(request({ plan: mutated, revision: 0 }), context(2026)); assert.equal(response.status, 200); assert.equal((await response.json()).record.revision, 1);
  assert.equal((await api.PUT(request({ plan, revision: 0 }), context(2026))).status, 409);
  const saved = await store.getPositionMapPlan(2026, {}); assert.deepEqual(saved.plan.positions[root.id], { required: 2, staffed: 4 });
  assert.equal((await store.getPositionMapPlan(2027, staff.counts)).revision, 0);
  response = await api.PUT(request({ plan, revision: 1 }), context(2026)); assert.equal(response.status, 200); assert.equal((await response.json()).record.revision, 2);
  assert.equal(invalidations, 2);
  response = await download.GET(new Request("http://localhost"), context(2026)); assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("content-disposition"), /Peta-Jabatan-DKPP-2026\.docx/);
  const zip = new PizZip(Buffer.from(await response.arrayBuffer())), xml = zip.file("word/document.xml").asText();
  assert(xml.includes('w:orient="landscape"')); assert(xml.includes("w:txbxContent")); assert(!zip.folder("word/media").file(/./).length, "The chart must be editable text, not a screenshot");
  assert.equal((xml.match(/<w:pageBreakBefore\/>/g) ?? []).length, 4);
  const definitive = await store.getPositionMapHeadSignatory();
  assert.equal(definitive.nip, employee.nip); assert.equal(definitive.status, "definitif");
  db.prepare("INSERT INTO plt_assignments VALUES(?,?,?,?,?,?,?)").run("active-head",employee.nip,root.name,"2026-10-01","2026-12-31",null,null);
  const plt = await store.getPositionMapHeadSignatory(); assert.equal(plt.status, "plt");
  const slots = JSON.parse(readFileSync("src/data/position-map-dinas-a4-slots.json", "utf8"));
  const dinasIds = slots.flatMap(slot => slot.roles);
  assert.equal(dinasIds.length, 92); assert.equal(new Set(dinasIds).size, 92);
  assert(dinasIds.every(id => !model.positionMapIsUptd(model.positionMapCatalog.find(p => p.id === id).unit)));
  response = await download.GET(new Request("http://localhost/api/position-map/2026/docx?preset=dinas-a4"), context(2026));
  assert.equal(response.status,200); assert.match(response.headers.get("content-disposition"),/Peta-Jabatan-Dinas-DKPP-2026-A4\.docx/);
  const a4Xml = new PizZip(Buffer.from(await response.arrayBuffer())).file("word/document.xml").asText();
  assert(a4Xml.includes('w:w="16838" w:h="11906"')); assert(!a4Xml.includes("<w:pageBreakBefore/>")); assert(!a4Xml.includes("UPTD"));
  assert(a4Xml.replace(/<[^>]*>/g, "").includes("Plt.")); assert(a4Xml.includes(employee.name)); assert(a4Xml.includes(employee.nip));
  const source = new PizZip(readFileSync("src/templates/template-position-map-dinas-a4.docx"));
  const templateXml = source.file("word/document.xml").asText();
  const text = xml => [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m=>m[1]).join("");
  const shape = (xml,id) => [...xml.matchAll(/<v:shape(?=[\s>])[^>]*>[\s\S]*?<\/v:shape>/g)].find(m=>m[0].includes(`id="${id}"`))[0];
  const referencePlan = structuredClone(plan);
  for (const slot of slots) {
    const rows = [...shape(templateXml,slot.shape).matchAll(/<w:tr(?=[\s>])[^>]*>[\s\S]*?<\/w:tr>/g)].slice(1);
    assert.equal(rows.length,slot.roles.length);
    rows.forEach((row,i)=>{
      const cells = [...row[0].matchAll(/<w:tc(?=[\s>])[^>]*>[\s\S]*?<\/w:tc>/g)].map(m=>text(m[0]));
      const values = slot.kind === "head" ? [...cells[0].matchAll(/-?\d+/g)].map(m=>Number(m[0])) : cells.slice(1).map(Number);
      referencePlan.positions[slot.roles[i]]={required:values[0],staffed:values[1]};
    });
  }
  const referenceSignatory = {name:"RORY FIRMANSYAH, S.STP, M.Si.",nip:"197801011997031003",rank:"Pembina Tk.I / IV/b",title:root.name+" KABUPATEN INDRAMAYU",status:"plt"};
  const exactBytes = createPositionMapDocx(referencePlan,2026,{preset:"dinas-a4",signatory:referenceSignatory});
  const exact = new PizZip(exactBytes);
  for(const [name,file] of Object.entries(source.files)) if(!file.dir) assert.deepEqual(exact.file(name).asNodeBuffer(),file.asNodeBuffer(),`Same-data export must retain ${name} exactly`);
  const changedBytes = createPositionMapDocx(mutated,2027,{preset:"dinas-a4",signatory:{...referenceSignatory,name:"KEPALA UJI & DATA",nip:"197901011999031002",rank:"Pembina / IV/a",status:"definitif"}});
  const changed=new PizZip(changedBytes),changedXml=changed.file("word/document.xml").asText(),changedText=text(changedXml);
  assert(changedText.includes("K: 2     B: 4     +/-: 2"));assert(changedText.includes("Tahun 2027"));assert(changedText.includes("KEPALA UJI &amp; DATA"));assert(changedText.includes("197901011999031002"));assert(!changedText.includes("Plt."));
  assert.equal(shape(changedXml,"MapText114").match(/<w:tr(?=[\s>])[^>]*>[\s\S]*?<\/w:tr>/g)[1],shape(templateXml,"MapText114").match(/<w:tr(?=[\s>])[^>]*>[\s\S]*?<\/w:tr>/g)[1],"Keep the exact split-run TTE marker row");
  assert(changedText.includes("${ttd_pengirim}"));
  for(const [name,file] of Object.entries(source.files)) if(!file.dir&&name!=="word/document.xml")assert.deepEqual(changed.file(name).asNodeBuffer(),file.asNodeBuffer(),`Preserve template part ${name}`);
  assert.equal((await download.GET(new Request("http://localhost/api/position-map/2026/docx?preset=bad"),context(2026))).status,422);
  db.prepare("UPDATE plt_assignments SET end_date='2026-10-30'").run(); assert.equal((await store.getPositionMapHeadSignatory()).status,"definitif");
  db.prepare("UPDATE employees SET status='Pensiun' WHERE nip=?").run(employee.nip);
  await assert.rejects(store.getPositionMapHeadSignatory,/Pastikan data kepala dinas/);
  db.prepare("UPDATE employees SET status='Aktif' WHERE nip=?").run(employee.nip);
  db.prepare("DELETE FROM users WHERE id='tester'").run(); assert.equal(db.prepare("SELECT count(*) n FROM position_map_plans").get().n, 1);
  if (process.argv[2]) {
    const fixture = JSON.parse(readFileSync(process.argv[2], "utf8"));
    const actual = model.currentPositionMapStaff(fixture.employees, "2026-11-18");
    const defaultPlan = model.defaultPositionMapPlan(actual.counts), actualPages = model.buildPositionMapPages(defaultPlan, 2026);
    const output = process.argv[3] ?? ".tmp/position-map";
    mkdirSync(output, { recursive: true });
    writeFileSync(path.join(output, "map.docx"), createPositionMapDocx(defaultPlan, 2026));
    writeFileSync(path.join(output, "model.json"), JSON.stringify({ plan: defaultPlan, pages: actualPages }));
    writeFileSync(path.join(output, "reference-match.docx"),exactBytes);
    writeFileSync(path.join(output, "changed-a4.docx"),changedBytes);
    const head = fixture.employees.find(e => e.name.startsWith("RORY"));
    assert(head, "Real fixture requires the verified current head");
    writeFileSync(path.join(output, "dinas-a4.docx"), createPositionMapDocx(defaultPlan, 2026, { preset: "dinas-a4", signatory: {
      name: head.name, nip: head.nip, rank: "Pembina Tk.I / IV/b", title: root.name + " KABUPATEN INDRAMAYU", status: "plt",
    } }));
    console.log("Real snapshot:", { active: actual.active, mapped: actual.mapped, unmapped: actual.unmapped, ...model.positionMapSummary(defaultPlan) });
  }
  console.log("Position map passed: 180 placements, 21 UPTD, 5 A3 pages, 92 dinas A4 slots, exact user-template preservation, TTE marker, dynamic counts/year/signatory, authorization, persistence and conflicts.");
} finally { db.close(); }
