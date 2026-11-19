import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import Database from "better-sqlite3";

const [file, mode, destination] = process.argv.slice(2);
if (!file) throw new Error("node scripts/import-planning-sipena.mjs <lampiran.md> [--sql <path> | --sqlite <admin.db>]");
const source = readFileSync(file, "utf8");
const json = source.includes("<!-- SIPENA_DATA_BEGIN -->")
  ? /^<!-- SIPENA_DATA_BEGIN -->\s*\x60{3}json\s*([\s\S]*?)\s*\x60{3}\s*<!-- SIPENA_DATA_END -->/m.exec(source)?.[1]
  : source;
assert(json, "Blok data SIPENA tidak ditemukan");
const payload = JSON.parse(json);
assert.equal(payload.format, "sipena.ptr.snapshot.v1");
const { data, years, snapshot } = payload;
const nodes = new Map(data.nodes.map(node => [node.id, node]));
assert.equal(nodes.size, 137);
const sub = data.nodes.filter(node => node.type === "subkegiatan");
assert.equal(sub.length, 91);
assert.equal(new Set(sub.map(node => node.code)).size, 91);
const indicators = new Map();
for (const node of data.nodes) {
  const seen = new Set([node.id]);
  for (let parent = node.parent; parent; parent = nodes.get(parent).parent) {
    assert(nodes.has(parent) && !seen.has(parent), "Induk tidak valid");
    seen.add(parent);
  }
  for (const indicator of node.indicators) {
    assert(!indicators.has(indicator.id), "ID indikator ganda");
    indicators.set(indicator.id, indicator);
  }
}
assert.equal(indicators.size, 149);
assert.equal([...indicators.values()].filter(i => i.iku).length, 7);
assert.equal(data.departments.length, 7);
assert.equal(payload.indicatorMethods.length, 40);
assert.equal(Object.keys(data.assignments).length, 546);
assert.equal(Object.values(data.assignments).filter(a => a.ownerUserId).length, 6);
const departments = new Set(data.departments.map(d => d.id));
const catalog = { snapshot, nodes: data.nodes, departments: data.departments, documents: data.documents,
  links: data.links, methods: payload.indicatorMethods, actors: payload.actorRefs };
const control = [[0, 0], [91, 24905338487], [90, 95642118034], [90, 101116578034], [90, 103139446034], [91, 106314658034]];
for (let i = 0; i < years.length; i++) {
  const year = years[i];
  const amounts = sub.map(node => {
    assert(departments.has(data.assignments[`${node.id}|${year}`]?.departmentId));
    const admin = data.budgets[`${node.id}|${year}`];
    if (admin) return admin.amount;
    const values = [...new Set(node.indicators.map(indicator => indicator.budgets?.[year]).filter(value => value != null))];
    return values.length === 1 ? values[0] : null;
  }).filter(value => value !== null);
  assert.deepEqual([amounts.length, amounts.reduce((a, b) => a + b, 0)], control[i]);
  if (year === 2026) assert.equal(amounts.filter(amount => amount === 0).length, 28);
  console.log(year, amounts.length, amounts.reduce((a, b) => a + b, 0));
}
const records = [];
function add(kind, subject, year, quarter, value) {
  assert(years.includes(year));
  assert([0, 1, 2, 3, 4].includes(quarter));
  const date = new Date(value.updatedAt ?? value.updated ?? value.uploadedAt ?? snapshot.exportedAt).toISOString();
  const actor = value.updatedBy ?? value.uploadedBy ?? "sipena";
  records.push([year, kind, subject, quarter, value.revision ?? 1, JSON.stringify(value), date, actor]);
}
const mappings = {
  node_assignment: data.assignments, indicator_assignment: data.indicatorAssignments, budget: data.budgets,
  financial: data.financials, evaluation: data.evaluations,
};
for (const [kind, entries] of Object.entries(mappings)) {
  for (const [key, value] of Object.entries(entries)) {
    const [id, year, quarter = 0] = key.split("|");
    assert((["indicator_assignment", "evaluation"].includes(kind) ? indicators : nodes).has(id));
    add(kind, id, Number(year), Number(quarter), value);
  }
}
for (const [key, value] of Object.entries(data.reportingPeriods)) {
  const [year, quarter] = key.split("|");
  add("period", "period", Number(year), Number(quarter), value);
}
for (const item of data.evidenceFiles) {
  assert(nodes.has(item.nodeId));
  if (item.indicatorId) assert(nodes.get(item.nodeId).indicators.some(ind => ind.id === item.indicatorId));
  add("evidence", item.id, item.year, item.quarter, item);
}
assert.equal(records.filter(row => row[1] === "financial").length, 1);
assert.equal(records.filter(row => row[1] === "evaluation").length, 2);
const audit = [randomUUID(), 2026, 0, "sipena_import", "sipena", "migration", new Date().toISOString(), "Impor snapshot SIPENA terverifikasi", null,
  JSON.stringify({ snapshot, records: records.length, nodes: nodes.size, indicators: indicators.size,
    sourceSha256: createHash("sha256").update(source).digest("hex") })];
const recordColumns = "year, kind, subject, quarter, revision, data_json, updated_at, updated_by";
const auditColumns = "id, year, quarter, kind, subject, actor, at_utc, reason, old_json, new_json";
if (mode === "--sqlite") {
  const db = new Database(destination, { fileMustExist: true });
  try {
    db.transaction(() => {
      const existing = db.prepare("SELECT data_json FROM planning_catalog WHERE source_system = 'sipena'").get();
      if (existing) {
        assert.equal(existing.data_json, JSON.stringify(catalog), "Snapshot berbeda. Tinjau konflik sebelum impor.");
        console.log("Snapshot sudah ada. Tidak ada data yang ditimpa.");
        return;
      }
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM planning_records").get().n, 0);
      db.prepare("INSERT INTO planning_catalog VALUES ('sipena', ?)").run(JSON.stringify(catalog));
      const yearInsert = db.prepare("INSERT INTO planning_years VALUES (?, ?)");
      for (const year of years) yearInsert.run(year, snapshot.planningRevision);
      const insert = db.prepare(`INSERT INTO planning_records(${recordColumns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const row of records) insert.run(...row);
      db.prepare(`INSERT INTO planning_audit(${auditColumns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...audit);
    })();
  } finally { db.close(); }
} else if (mode === "--sql") {
  const literal = value => value === null ? "NULL" : typeof value === "number" ? String(value) : "'" + String(value).replaceAll("'", "''") + "'";
  const tuple = row => "(" + row.map(literal).join(",") + ")";
  const catalogValue = literal(JSON.stringify(catalog));
  const delimiter = "$planning_" + randomUUID().replaceAll("-", "") + "$";
  assert(!source.includes(delimiter));
  // Serialize the seed, preserve existing operational changes, and reject a
  // different snapshot instead of merging it into live data without review.
  const sql = `BEGIN;
SET LOCAL standard_conforming_strings = on;
LOCK TABLE adminflow.planning_catalog IN SHARE ROW EXCLUSIVE MODE;
DO ${delimiter}
DECLARE incoming jsonb := ${catalogValue}::jsonb;
BEGIN
IF EXISTS (SELECT 1 FROM adminflow.planning_catalog WHERE data_json <> incoming) THEN
  RAISE EXCEPTION 'Snapshot SIPENA berbeda. Tinjau konflik terlebih dahulu.';
END IF;
IF NOT EXISTS (SELECT 1 FROM adminflow.planning_catalog) THEN
  INSERT INTO adminflow.planning_catalog VALUES ('sipena', incoming);
  INSERT INTO adminflow.planning_years (year, revision) VALUES ${years.map(year => tuple([year, snapshot.planningRevision])).join(",")};
  INSERT INTO adminflow.planning_records (${recordColumns}) VALUES ${records.map(tuple).join(",\n")};
  INSERT INTO adminflow.planning_audit (${auditColumns}) VALUES ${tuple(audit)};
END IF;
END;
${delimiter};
COMMIT;`;
  writeFileSync(destination, sql);
}
console.log(`${nodes.size} simpul, ${indicators.size} indikator, ${records.length} rekaman. Cakupan akun tidak dibuat otomatis.`);
