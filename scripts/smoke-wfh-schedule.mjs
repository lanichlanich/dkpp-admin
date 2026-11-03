import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import Database from "better-sqlite3";
import ts from "typescript";

const require = createRequire(import.meta.url), db = new Database(":memory:");
db.pragma("foreign_keys=ON");
db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES('schedule-test');
  CREATE TABLE employees(nip TEXT PRIMARY KEY,name TEXT,position TEXT,unit TEXT,status TEXT);
  CREATE TABLE wfh_schedule_months(period TEXT PRIMARY KEY,source_period TEXT,created_by TEXT REFERENCES users(id),created_at TEXT);
  CREATE TABLE wfh_schedule_entries(period TEXT REFERENCES wfh_schedule_months(period) ON DELETE CASCADE,employee_nip TEXT,employee_name TEXT,position TEXT,unit TEXT,sort_order INTEGER,friday_date TEXT,status TEXT CHECK(status IN('WFH','WFO')),updated_by TEXT REFERENCES users(id),updated_at TEXT,PRIMARY KEY(period,employee_nip,friday_date));`);
const a = "199001012020121001", b = "199002022020122001", retired = "196501011990031001", moved = "198001012010011001";
for (const [nip, name, status] of [[a,"Pegawai Satu","Aktif"],[b,"Pegawai Dua","Aktif"],[retired,"Pegawai Pensiun","Pensiun"],[moved,"Pegawai Mutasi","Mutasi"]]) db.prepare("INSERT INTO employees VALUES(?,?, 'Pelaksana','Unit Uji',?)").run(nip,name,status);
for (const period of ["2026-10","2026-11"]) db.prepare("INSERT INTO wfh_schedule_months VALUES(?,NULL,'schedule-test','2026-11-03')").run(period);
let signedIn = true, allowed = true, queries = 0;
const paths = [], cache = new Map();
const adapter = {
  prepare(sql) { queries++; const statement = db.prepare(sql); return { get: async (...values) => statement.get(...values), all: async (...values) => statement.all(...values), run: async (...values) => statement.run(...values) }; },
  transaction: async statements => db.transaction(() => { for (const {sql,values} of statements) db.prepare(sql).run(...values); })(),
};
function load(file) {
  const filename = path.resolve(file); if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); cache.set(filename, mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name === "next/cache") return { revalidatePath: p => paths.push(p) };
    if (name === "@/lib/database") return { database: adapter };
    if (name === "@/lib/authorization") return { requireMenuAccess: async menu => { assert.equal(menu,"daftar-wfh"); if (!signedIn) throw Error("Unauthorized"); if (!allowed) throw Error("Forbidden"); return {id:"schedule-test"}; } };
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
  return mod.exports;
}
const actions = load("src/actions/wfh-schedule.ts"), schedule = load("src/lib/wfh-schedule.ts");
const entries = (period, nip) => db.prepare("SELECT * FROM wfh_schedule_entries WHERE period=? AND employee_nip=? ORDER BY friday_date").all(period,nip);
try {
  assert.equal(schedule.fridayDates("2026-10").length,5); assert.equal(schedule.fridayDates("2026-11").length,4);
  for (const args of [["2026-13",a],["2026-11","invalid"],["2026-11",a,"INVALID"],["2027-03",a],["2026-11",retired],["2026-11",moved],["2026-11","190001012000011001"]]) assert.equal((await actions.addScheduleEmployee(...args)).success,false);
  assert.equal((await actions.addScheduleEmployee("2026-10",a)).success,true); assert.equal(entries("2026-10",a).length,5); assert(entries("2026-10",a).every(row=>row.status==="WFO"));
  assert.equal((await actions.addScheduleEmployee("2026-11",a,"WFH")).success,true); assert.equal(entries("2026-11",a).length,4); assert(entries("2026-11",a).every(row=>row.status==="WFH"));
  assert.equal((await actions.addScheduleEmployee("2026-11",b)).success,true); assert(entries("2026-11",b)[0].sort_order>entries("2026-11",a)[0].sort_order);
  assert.equal((await actions.setScheduleStatus("2026-11",a,"2026-11-06","WFO")).success,true);
  const saved = entries("2026-11",a); assert.equal((await actions.addScheduleEmployee("2026-11",a,"WFH")).success,false); assert.deepEqual(entries("2026-11",a),saved,"Duplicate add preserves manual statuses");
  for (const args of [["2026-11",a],["2026-11",a,"true"],["2026-13",a,true],["2026-11","invalid",true]]) assert.equal((await actions.removeScheduleEmployee(...args)).success,false);
  assert.deepEqual(entries("2026-11",a),saved,"Unconfirmed and invalid deletes do not mutate data");
  const otherMonth = entries("2026-10",a), otherEmployee = entries("2026-11",b);
  assert.equal((await actions.removeScheduleEmployee("2026-11",a,true)).success,true); assert.deepEqual(entries("2026-11",a),[]); assert.deepEqual(entries("2026-10",a),otherMonth); assert.deepEqual(entries("2026-11",b),otherEmployee); assert.equal(db.prepare("SELECT count(*) n FROM employees").get().n,4);
  assert.equal((await actions.removeScheduleEmployee("2026-11",a,true)).success,false);
  assert.equal((await actions.addScheduleEmployee("2026-11",a,"WFO")).success,true); assert(entries("2026-11",a).every(row=>row.status==="WFO")); assert(entries("2026-11",a)[0].sort_order>entries("2026-11",b)[0].sort_order);
  db.prepare("UPDATE employees SET status='Mutasi' WHERE nip=?").run(b); assert.equal((await actions.removeScheduleEmployee("2026-11",b,true)).success,true,"Inactive historical members remain removable");
  assert.equal(schedule.groupScheduleEntries(await schedule.getScheduleEntries("2026-11")).length,1);
  assert.equal((await actions.continueScheduleMonth("2026-11")).success,true); assert.equal(entries("2026-12",a).length,4); const december = entries("2026-12",a);
  assert.equal((await actions.removeScheduleEmployee("2026-11",a,true)).success,true); assert.deepEqual(await schedule.getScheduleEntries("2026-11"),[]); assert(db.prepare("SELECT period FROM wfh_schedule_months WHERE period='2026-11'").get()); assert.deepEqual(entries("2026-12",a),december);
  assert.equal((await actions.continueScheduleMonth("2026-11")).success,false); assert.deepEqual(entries("2026-12",a),december,"Empty source does not overwrite next month");
  assert.equal((await actions.createScheduleMonth("2027-01")).success,true); assert.equal(entries("2027-01",a).length,5);
  for (const mode of ["anonymous","denied"]) { signedIn=mode!=="anonymous"; allowed=false; const before=queries; await assert.rejects(actions.addScheduleEmployee("2026-11",a),/Unauthorized|Forbidden/); await assert.rejects(actions.removeScheduleEmployee("2026-10",a,true),/Unauthorized|Forbidden/); assert.equal(queries,before); }
  assert(paths.includes("/dashboard/daftar-wfh")&&paths.includes("/dashboard/laporan-pegawai-wfh-wfo"));
  console.log("PASS WFH/WFO schedule: active-only add, default/selected status, four/five Fridays, duplicate/manual-status preservation, explicit delete confirmation, month/employee isolation, master preservation, re-add, inactive removal, empty roster, month continuation and server authorization.");
} finally { db.close(); }
