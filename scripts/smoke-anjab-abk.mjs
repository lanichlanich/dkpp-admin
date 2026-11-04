import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import Database from "better-sqlite3";
import ts from "typescript";

const require = createRequire(import.meta.url), cache = new Map(), db = new Database(":memory:");
db.pragma("foreign_keys=ON");
db.exec("CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES('anjab-test');");
db.exec(readFileSync("src/lib/db.ts", "utf8").match(/CREATE TABLE IF NOT EXISTS anjab_abk_plans \([\s\S]*?\);/)[0]);
let queries = 0, access = "allowed";
const invalidations = [];
const adapter = { prepare(sql) { queries++; const s = db.prepare(sql); return { get: async (...v) => s.get(...v), all: async (...v) => s.all(...v), run: async (...v) => s.run(...v) }; } };
function load(file) {
  const filename = path.resolve(file); if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); cache.set(filename, mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name === "@/lib/database") return { database: adapter };
    if (name === "next/cache") return { revalidatePath: p => invalidations.push(p) };
    if (name === "@/lib/session") return { getCurrentUser: async () => access === "anonymous" ? null : { id: "anjab-test" } };
    if (name === "@/lib/authorization") return { checkApiAccess: async menus => { assert.deepEqual(menus, ["anjab-abk"]); return access === "allowed" ? null : Response.json({}, { status: access === "anonymous" ? 401 : 403 }); } };
    if (name.endsWith(".json")) return require(path.resolve(name.replace(/^@\//, "src/")));
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const calc = load("src/lib/anjab-abk-calculation.ts"), { anjabCatalog: catalog } = load("src/lib/anjab-abk-source.ts");
const service = load("src/lib/anjab-abk.ts"), api = load("src/app/api/anjab-abk/[year]/route.ts");
const levels = calc.allAnjabLevels(catalog), baseline = calc.defaultAnjabPlan(catalog), schema = calc.createAnjabPlanSchema(catalog);
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const context = year => ({ params: Promise.resolve({ year: String(year) }) });
const put = (year, plan, revision) => api.PUT(new Request("http://test", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, revision }) }), context(year));
try {
  assert.equal(catalog.sources.length, 6); assert.equal(catalog.sources.reduce((n, f) => n + f.sheets.length, 0), 26);
  assert.equal(levels.length, 23); assert.equal(levels.reduce((n, l) => n + l.tasks.length, 0), 465); assert(schema.safeParse(baseline).success);
  const expected = [
    ["medik-veteriner", [37.865, 205.78, 150.614], [1, 8, 12]],
    ["paramedik-veteriner", [55.4, 50.5, 51.484, 21.58], [2, 4, 10, 6]],
    ["pengawas-bibit-ternak", [46.365, 55.434, 50.554, 28.8, 41.638, 32.252], [1, 2, 4, 2, 4, 9]],
    ["pengawas-mutu-pakan", [58.185, 77.64, 53.6, 50.91, 52.425, 20.974, 19.238], [1, 2, 4, 2, 4, 4, 5]],
    ["analis-psp", [44.2, 51.658, 33.618], [1, 2, 3]],
  ];
  const result = calc.calculateAnjab(baseline, catalog);
  for (const [id, totals, needs] of expected) catalog.families.find(f => f.id === id).levels.forEach((level, i) => { close(result.levels[level.id].total, totals[i]); assert.equal(result.levels[level.id].need, needs[i]); });
  assert.equal(result.total.need, 93); assert.equal(result.total.proposedPns, 63); assert.equal(result.total.proposedPppk, 31); assert.equal(result.total.proposed, 94);
  assert.equal(result.total.existingPns, 10); assert.equal(result.total.existingPppk, 8); assert.equal(result.total.existing, 18); assert.equal(result.total.shortage, 76);
  assert.equal(result.total.placed, 94); assert.equal(result.total.placedPns, 61); assert.equal(result.total.placedPppk, 33);
  assert.equal(result.agency.score, 90); assert.equal(result.agency.allocated, 88); assert.equal(result.agency.remainder, 2); assert.equal(result.agency.existing, 17); assert.equal(result.agency.shortage, 71);
  assert.equal(result.agency.scoreShortage,73,"Preserve PERHITUNGAN!M13 as a distinct comparison against the pre-FLOOR score");
  assert(Object.values(result.agency.allocations).every(value => value === 22));
  for (const [value, score] of [[0,25],[10,25],[11,50],[20,50],[21,75],[30,75],[31,100]]) { const p = structuredClone(baseline); p.variables.districtCount = value; assert.equal(calc.calculateAnjab(p,catalog).agency.districtScore,score); }
  for (const [value, score] of [[0,25],[1,50],[3,50],[4,75],[9,75],[10,100]]) { const p = structuredClone(baseline); p.variables.serviceUnitCount = value; assert.equal(calc.calculateAnjab(p,catalog).agency.unitScore,score); }
  for (const [type, score] of [["A",100],["B",75],["C",50],["D",25]]) { const p = structuredClone(baseline); p.variables.agencyType = type; assert.equal(calc.calculateAnjab(p,catalog).agency.typeScore,score); }
  const omitted = structuredClone(baseline); omitted.levels["pengawas-bibit-ternak-pelaksana"].tasks.r28.volume += 100;
  close(calc.calculateAnjab(omitted,catalog).levels["pengawas-bibit-ternak-pelaksana"].total,32.252+100*omitted.levels["pengawas-bibit-ternak-pelaksana"].tasks.r28.credit);
  assert.notDeepEqual(omitted,calc.defaultAnjabPlan(catalog)); assert.deepEqual(baseline,calc.defaultAnjabPlan(catalog),"Editing a plan must not mutate the source catalog");
  const zero = structuredClone(baseline), level = levels[0]; Object.values(zero.levels[level.id].tasks).forEach(task=>task.volume=0); assert.equal(calc.calculateAnjab(zero,catalog).levels[level.id].need,0);
  zero.levels[level.id].divisor=2;zero.levels[level.id].tasks[level.tasks[0].id]={volume:1,credit:1};assert.equal(calc.calculateAnjab(zero,catalog).levels[level.id].need,1,"Excel ROUND rounds positive 0.5 up");
  zero.levels[level.id].tasks[level.tasks[0].id].volume=2.4;assert.equal(calc.calculateAnjab(zero,catalog).levels[level.id].need,1,"Use nearest rounding, not CEIL");
  for (const change of [p=>{p.levels[level.id].divisor=0;},p=>{p.levels[level.id].tasks[level.tasks[0].id].volume=-1;},p=>{delete p.levels[level.id].tasks[level.tasks[0].id];},p=>{p.levels.fake=p.levels[level.id];},p=>{p.levels[level.id].staffing.needPns=0.5;},p=>{p.variables.shares.fake=0;},p=>{p.variables.weights.agency=0.4;},p=>{delete p.levels[level.id].placements.bidang;},p=>{p.levels[level.id].divisor=Number.MIN_VALUE;}]) { const p=structuredClone(baseline);change(p);assert(!schema.safeParse(p).success); }
  const missing=structuredClone(baseline);missing.levels[level.id].tasks[level.tasks[0].id].volume=NaN;assert.equal(calc.calculateAnjab(missing,catalog).total.need,null,"Incomplete detail must not become a healthy zero");
  const invalidWeights=structuredClone(baseline);invalidWeights.variables.weights.agency=0.4;assert.equal(calc.calculateAnjab(invalidWeights,catalog).agency.score,null);
  const overflow=structuredClone(baseline);overflow.levels[level.id].staffing.needPns=Number.MAX_SAFE_INTEGER;overflow.levels[level.id].staffing.needPppk=Number.MAX_SAFE_INTEGER;assert(!schema.safeParse(overflow).success,"Reject aggregate counts that cannot be represented accurately");
  const over=structuredClone(baseline);over.levels[level.id].staffing.existingPns=4;assert.equal(calc.calculateAnjab(over,catalog).levels[level.id].shortage,-2,"Overstaffing remains signed");
  assert.equal((await service.getAnjabPlan(2026)).revision,0);
  const first=await service.saveAnjabPlan(2026,baseline,0,"anjab-test");assert.equal(first.revision,1);
  await assert.rejects(service.saveAnjabPlan(2026,omitted,0,"anjab-test"),e=>e.status===409);
  const second=await service.saveAnjabPlan(2026,omitted,1,"anjab-test");assert.equal(second.revision,2);
  await assert.rejects(service.saveAnjabPlan(2026,baseline,1,"anjab-test"),e=>e.status===409);assert.deepEqual((await service.getAnjabPlan(2026)).plan,omitted);
  assert.equal((await service.getAnjabPlan(2027)).revision,0);assert.deepEqual((await service.getAnjabPlan(2027)).plan,baseline);
  await service.saveAnjabPlan(2027,zero,0,"anjab-test");assert.deepEqual((await service.getAnjabPlan(2026)).plan,omitted,"Year updates are isolated");
  for(const mode of ["anonymous","denied"]){access=mode;const before=queries;assert.equal((await api.GET(new Request("http://test"),context(2026))).status,mode==="anonymous"?401:403);assert.equal((await put(2026,baseline,2)).status,mode==="anonymous"?401:403);assert.equal(queries,before);}
  access="allowed";
  assert.equal((await api.GET(new Request("http://test"),context("2026;DROP TABLE users"))).status,400);
  assert.equal((await put(2100,baseline,0)).status,400);assert.equal((await put(2026,baseline,1)).status,409);
  const bad=structuredClone(baseline);bad.levels[level.id].divisor=0;assert.equal((await put(2026,bad,2)).status,422);
  assert.equal((await api.PUT(new Request("http://test",{method:"PUT",body:"{"}),context(2026))).status,400);
  assert.equal((await api.PUT(new Request("http://test",{method:"PUT",body:" ".repeat(512*1024+1)}),context(2026))).status,413);
  assert.equal((await put(2026,baseline,2)).status,200);const get=await api.GET(new Request("http://test"),context(2026));assert.equal(get.headers.get("cache-control"),"private, no-store");assert.equal((await get.json()).revision,3);
  assert(invalidations.includes("/dashboard/anjab-abk"));
  db.prepare("DELETE FROM users WHERE id='anjab-test'").run();assert.equal(db.prepare("SELECT count(*) n FROM anjab_abk_plans").get().n,2,"Planner survives deletion of its editor");
  console.log("PASS Anjab-ABK: 6 files/26 sheets/23 levels/465 activities, all source totals, corrected SUM omissions, rounding/zero/missing inputs, independent proposals and placements, scoring boundaries/FLOOR remainder, schema validation, auth, persistence, year isolation, conflict protection and backup-compatible data.");
}finally{db.close();}
