import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import Database from "better-sqlite3";
import ts from "typescript";

const require = createRequire(import.meta.url);
const db = new Database(":memory:");
const schema = readFileSync("src/lib/db.ts", "utf8");
db.exec(schema.match(/CREATE TABLE IF NOT EXISTS employees \([\s\S]*?\);/)[0]);
db.exec("CREATE TABLE job_positions (id TEXT PRIMARY KEY, name TEXT, unit TEXT, position_type TEXT, echelon TEXT)");
const migration = schema.slice(schema.indexOf("const employeeColumns ="), schema.indexOf("const jobPositionColumns ="));
const migrate = new Function("db", ts.transpile(migration, { target: ts.ScriptTarget.ES2022 }));
migrate(db);
migrate(db);
db.prepare("INSERT INTO job_positions VALUES (?, ?, ?, ?, ?)").run("position-test", "Pelaksana", "Dinas", "JFU", "-");
const adapter = { prepare(sql) { const statement = db.prepare(sql); return {
  get: async (...values) => statement.get(...values),
  run: async (...values) => statement.run(...values),
}; } };
let signedIn = true;
const exports = {};
const actions = ts.transpileModule(readFileSync("src/actions/employees.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function("require", "exports", actions)((name) => {
  if (name === "@/lib/database") return { database: adapter };
  if (name === "@/lib/authorization") return { requireMenuAccess: async () => { if (!signedIn) throw new Error("Unauthorized"); return { id: "test-user" }; } };
  if (name === "@/lib/notifications") return { createNotification: async () => {} };
  if (name === "@/lib/job-position-visibility") return { isInactiveJobPositionName: () => false };
  if (name === "next/cache") return { revalidatePath: () => {} };
  return require(name);
}, exports);
const nip = "199001012020121001";
function form(mode, birthPlace) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ mode, originalNip: mode === "edit" ? nip : "", nip, name: "Pegawai pengujian", parentUnit: "Dinas", jobPositionId: "position-test", rank: "III/a", asnType: "PNS", status: "Aktif" })) data.set(key, value);
  if (birthPlace !== undefined) data.set("birthPlace", birthPlace);
  return data;
}
try {
  assert.equal((await exports.saveEmployeeAction({}, form("create", "  INDRAMAYU  "))).status, "success");
  assert.equal(db.prepare("SELECT birth_place FROM employees WHERE nip = ?").get(nip).birth_place, "INDRAMAYU");
  assert.equal((await exports.saveEmployeeAction({}, form("edit", "Kota baru manual"))).status, "success");
  assert.equal(db.prepare("SELECT birth_place FROM employees WHERE nip = ?").get(nip).birth_place, "Kota baru manual");
  assert.equal((await exports.saveEmployeeAction({}, form("edit", undefined))).status, "success");
  assert.equal(db.prepare("SELECT birth_place FROM employees WHERE nip = ?").get(nip).birth_place, "Kota baru manual", "Old forms must retain the imported birthplace");
  assert.equal((await exports.saveEmployeeAction({}, form("edit", "x".repeat(161)))).status, "error");
  const changedNip = form("edit", "BANDUNG");
  changedNip.set("nip", "199001012020121002");
  assert.equal((await exports.saveEmployeeAction({}, changedNip)).status, "error");
  assert.equal((await exports.saveEmployeeAction({}, form("edit", ""))).status, "success");
  assert.equal(db.prepare("SELECT birth_place FROM employees WHERE nip = ?").get(nip).birth_place, "");
  signedIn = false;
  await assert.rejects(() => exports.saveEmployeeAction({}, form("edit", "CIREBON")), /Unauthorized/);
  console.log("Birthplace smoke passed: idempotent migration, create/edit, manual value, trim, clear, legacy forms, validation, NIP identity and authentication.");
} finally {
  db.close();
}
