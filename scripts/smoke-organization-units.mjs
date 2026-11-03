import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import ts from "typescript";

const db = new Database(":memory:");
db.pragma("foreign_keys=ON");
db.exec(`CREATE TABLE organization_units(id TEXT PRIMARY KEY,name TEXT,parent_id TEXT REFERENCES organization_units(id));
  CREATE TABLE job_positions(id TEXT PRIMARY KEY,organization_unit_id TEXT REFERENCES organization_units(id));
  CREATE TABLE employees(nip TEXT PRIMARY KEY,job_position_id TEXT REFERENCES job_positions(id),status TEXT,asn_type TEXT);`);
let signedIn = true, queries = 0;
const service = {};
new Function("require", "exports", ts.transpileModule(readFileSync("src/lib/organization-units.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(name => {
  if (name === "server-only") return {};
  if (name === "react") return { cache: fn => fn };
  if (name === "@/lib/session") return { requireUser: async () => { if (!signedIn) throw Error("Unauthorized"); } };
  if (name === "@/lib/database") return { database: { prepare(sql) { queries++; return { all: async () => db.prepare(sql).all() }; } } };
  throw Error(`Unexpected import: ${name}`);
}, service);

function unit(id, name, parent = null) {
  db.prepare("INSERT INTO organization_units VALUES(?,?,?)").run(id, name, parent);
  db.prepare("INSERT INTO job_positions VALUES(?,?)").run(`job-${id}`, id);
}
let serial = 0;
function employees(unitId, count, status = "Aktif", asnType = "PNS") {
  for (let i = 0; i < count; i++) db.prepare("INSERT INTO employees VALUES(?,?,?,?)").run(String(++serial), `job-${unitId}`, status, asnType);
}
const counts = rows => Object.fromEntries(rows.map(row => [row.id, row.employeeCount]));
try {
  assert.deepEqual(await service.getOrganizationUnits(), []);
  unit("dinas", "DINAS"); unit("sekretariat", "SEKRETARIAT", "dinas");
  unit("subbag", "SUB BAGIAN UMUM", "sekretariat"); unit("leaf", "UNIT ARSIP", "subbag");
  unit("uptd", "UPTD", "dinas"); unit("tu", "SUB TU", "uptd");
  unit("bidang", "BIDANG", "dinas"); unit("empty", "UNIT KOSONG", "dinas");
  unit("other", "DINAS LAIN"); unit("inactive", "UNIT PENSIUN", "other");
  employees("dinas", 1); employees("sekretariat", 2); employees("subbag", 3, "Aktif", "PPPK");
  employees("leaf", 4, "Aktif", "PPPK PW"); employees("uptd", 2); employees("tu", 3);
  employees("bidang", 1); employees("other", 2);
  employees("dinas", 5, "Pensiun"); employees("subbag", 3, "Mutasi"); employees("leaf", 4, "Pensiun");
  employees("inactive", 6, "Pensiun"); employees("tu", 2, "Mutasi");
  db.prepare("INSERT INTO job_positions VALUES('unassigned',NULL)").run();
  db.prepare("INSERT INTO employees VALUES('unassigned','unassigned','Aktif','PNS')").run();
  db.prepare("INSERT INTO job_positions VALUES('second-job','subbag')").run();
  db.prepare("UPDATE employees SET job_position_id='second-job' WHERE nip='4'").run();
  const expected = { dinas: 16, sekretariat: 9, subbag: 7, leaf: 4, uptd: 5, tu: 3, bidang: 1, empty: 0, other: 2, inactive: 0 };
  let rows = await service.getOrganizationUnits(); assert.deepEqual(counts(rows), expected);
  assert.equal(rows.find(row => row.id === "subbag").positionCount, 2, "Position count remains direct and includes unoccupied jobs");
  assert.equal(rows.find(row => row.id === "leaf").parentName, "SUB BAGIAN UMUM");
  assert.equal(rows.find(row => row.id === "dinas").parentId, null);
  assert.deepEqual(rows.map(row => row.name), [...rows.map(row => row.name)].sort());
  db.prepare("UPDATE organization_units SET name='AAAA ROOT' WHERE id='dinas'").run();
  assert.deepEqual(counts(await service.getOrganizationUnits()), expected, "Totals do not depend on alphabetical/traversal order");
  db.prepare("UPDATE employees SET status='Mutasi' WHERE nip='7'").run();
  assert.deepEqual(counts(await service.getOrganizationUnits()), { ...expected, leaf: 3, subbag: 6, sekretariat: 8, dinas: 15 }, "Status change reaches every ancestor");
  db.prepare("UPDATE organization_units SET parent_id='uptd' WHERE id='subbag'").run();
  assert.deepEqual(counts(await service.getOrganizationUnits()), { ...expected, leaf: 3, subbag: 6, sekretariat: 2, uptd: 11, dinas: 15 }, "Reparented subtree moves its entire active total exactly once");
  db.prepare("UPDATE job_positions SET organization_unit_id='bidang' WHERE id='job-leaf'").run();
  assert.deepEqual(counts(await service.getOrganizationUnits()), { ...expected, leaf: 0, subbag: 3, sekretariat: 2, uptd: 8, bidang: 4, dinas: 15 }, "Placement changes affect the new unit and ancestors");
  unit("self", "SELF"); employees("self", 2); db.prepare("UPDATE organization_units SET parent_id='self' WHERE id='self'").run();
  unit("cycle-a", "CYCLE A"); unit("cycle-b", "CYCLE B", "cycle-a"); employees("cycle-a", 1); employees("cycle-b", 2);
  db.prepare("UPDATE organization_units SET parent_id='cycle-b' WHERE id='cycle-a'").run();
  rows = await service.getOrganizationUnits(); assert.equal(counts(rows).self, 2); assert.equal(counts(rows)["cycle-a"], 3); assert.equal(counts(rows)["cycle-b"], 3);
  signedIn = false; const before = queries; await assert.rejects(service.getOrganizationUnits(), /Unauthorized/); assert.equal(queries, before);
  console.log("PASS organization units: active-only SQL, four-level accumulation, independent branches/roots, multiple positions and ASN types, no double counting, empty/inactive units, status and placement changes, subtree moves, cycle protection and authentication.");
} finally { db.close(); }
