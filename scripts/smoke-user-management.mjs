import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import Database from "better-sqlite3";
import ts from "typescript";
const require = createRequire(import.meta.url);
const db = new Database(":memory:");
const dbSource = readFileSync("src/lib/db.ts", "utf8");
db.exec(dbSource.match(/CREATE TABLE IF NOT EXISTS users \([\s\S]*?\);/)[0]);
db.exec(dbSource.match(/CREATE TABLE IF NOT EXISTS sessions \([\s\S]*?\);/)[0]);
const now = new Date().toISOString();
const addLegacyUser = db.prepare("INSERT INTO users (id,name,username,email,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?)");
addLegacyUser.run("admin-test", "Admin", "admin1", "admin1@dkpp.com", "original-hash", now, now);
addLegacyUser.run("planner-test", "Perencana", "perencana-test", "perencana@example.test", "original-hash", now, now);
const start = dbSource.indexOf("db.exec(`CREATE TABLE IF NOT EXISTS app_roles");
const end = dbSource.indexOf('db.exec("CREATE INDEX IF NOT EXISTS users_role_id_idx', start);
const migration = dbSource.slice(start, dbSource.indexOf(";", end) + 1);
const migrate = new Function("db", ts.transpile(migration, { target: ts.ScriptTarget.ES2022 }));
migrate(db); migrate(db);
assert.equal(db.prepare("SELECT role_id FROM users WHERE id = ?").get("admin-test").role_id, "administrator");
assert.equal(db.prepare("SELECT password_hash FROM users WHERE id = ?").get("admin-test").password_hash, "original-hash");
assert.equal(db.prepare("SELECT role_id FROM users WHERE id = ?").get("planner-test").role_id, "unassigned");
let actorId = "admin-test";
const modules = new Map();
const adapter = { prepare(sql) { const statement = db.prepare(sql); return {
  get: async (...values) => statement.get(...values), all: async (...values) => statement.all(...values), run: async (...values) => statement.run(...values),
}; }, transaction: async statements => db.transaction(() => { for (const s of statements) db.prepare(s.sql).run(...s.values); })() };
function currentUser() {
  const row = db.prepare("SELECT users.*, app_roles.name AS role_name, app_roles.is_administrator, app_roles.menu_permissions AS role_permissions FROM users JOIN app_roles ON app_roles.id = users.role_id WHERE users.id = ? AND users.is_active = 1").get(actorId);
  return row ? load("@/lib/db-types").mapPublicUser(row) : null;
}
function load(name) {
  if (name === "server-only") return {};
  if (name === "next/cache") return { revalidatePath() {} };
  if (name === "next/navigation") return { redirect: destination => { throw new Error(`Redirect:${destination}`); } };
  if (name === "@/lib/database") return { database: adapter };
  if (name === "@/lib/session") return { getCurrentUser: async () => currentUser(), requireUser: async () => { const user = currentUser(); if (!user) throw new Error("Unauthorized"); return user; }, createSession: async id => { actorId = id; } };
  if (name === "@/lib/notifications") return { createNotification: async () => {} };
  if (!name.startsWith("@/")) return require(name);
  if (modules.has(name)) return modules.get(name);
  const exports = {}; modules.set(name, exports);
  const source = readFileSync(`src/${name.slice(2)}.ts`, "utf8");
  new Function("require", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(load, exports);
  return exports;
}
function form(values) { const result = new FormData(); for (const [key, value] of Object.entries(values)) for (const item of Array.isArray(value) ? value : [value]) result.append(key, item); return result; }
const actions = load("@/actions/user-management");
const access = load("@/lib/access-control");
const authorization = load("@/lib/authorization");
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
try {
  assert(currentUser().isAdministrator);
  assert.equal((await actions.saveUserAccessAction({}, form({ id: "admin-test", roleId: "perencana", active: "on" }))).status, "error");
  assert.equal((await actions.saveUserAccessAction({}, form({ id: "admin-test", roleId: "administrator" }))).status, "error");
  assert.equal((await actions.saveRoleAction({}, form({ id: "administrator", name: "Hacked", menus: ["pembuatan-kak"] }))).status, "error");
  assert.equal((await actions.saveUserAccessAction({}, form({ id: "planner-test", roleId: "perencana", active: "on" }))).status, "success");
  actorId = "planner-test";
  assert(access.canAccessPath(currentUser(), "/dashboard/pembuatan-kak"));
  for (const menu of access.MENU_CATALOG.filter(m => m.id !== "pembuatan-kak")) assert.equal(access.canAccessMenu(currentUser(), menu.id), false);
  assert.equal(await authorization.checkApiAccess(["pembuatan-kak"]), null);
  assert.equal((await authorization.checkApiAccess(["pegawai"])).status, 403);
  assert.equal((await authorization.checkApiAccess(["unknown"])).status, 403);
  await assert.rejects(() => actions.saveRoleAction({}, form({ name: "Escalation" })), /administrator/);
  await assert.rejects(() => actions.saveUserAccessAction({}, form({ id: "planner-test", roleId: "administrator", active: "on" })), /administrator/);
  await assert.rejects(() => load("@/actions/employees").bulkEmployeeAction({ nips: ["199001012020121001"], operation: "delete" }), /Redirect/);
  actorId = "admin-test";
  assert.equal((await actions.saveRoleAction({}, form({ id: "perencana", name: "Perencana", menus: ["pembuatan-kak", "arsip-dinas"] }))).status, "success");
  actorId = "planner-test";
  assert(access.canAccessMenu(currentUser(), "arsip-dinas"), "Role edits must immediately affect active users");
  actorId = "admin-test";
  assert.equal((await actions.saveUserAccessAction({}, form({ id: "planner-test", roleId: "perencana", active: "on", customMenus: "on", menus: ["pegawai"] }))).status, "success");
  actorId = "planner-test";
  assert(access.canAccessMenu(currentUser(), "pegawai"));
  assert.equal(access.canAccessMenu(currentUser(), "pembuatan-kak"), false, "Overrides replace rather than add to role permissions");
  actorId = "admin-test";
  assert.equal((await actions.saveUserAccessAction({}, form({ id: "planner-test", roleId: "perencana", active: "on", customMenus: "on", menus: ["invalid"] }))).status, "error");
  assert.equal((await actions.saveUserAccessAction({}, form({ id: "planner-test", roleId: "perencana", active: "on", customMenus: "on" }))).status, "success");
  actorId = "planner-test"; assert.equal(access.landingPath(currentUser()), "/dashboard/akses");
  actorId = "admin-test";
  await actions.saveUserAccessAction({}, form({ id: "planner-test", roleId: "perencana", active: "on" }));
  db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run("token-test", "planner-test", now, now);
  await actions.saveUserAccessAction({}, form({ id: "planner-test", roleId: "perencana" }));
  assert.equal(db.prepare("SELECT count(*) AS total FROM sessions WHERE user_id = ?").get("planner-test").total, 0);
  actorId = "planner-test"; assert.equal(currentUser(), null); assert.equal((await authorization.checkApiAccess(["pembuatan-kak"])).status, 401);
  actorId = "admin-test";
  assert.equal((await actions.createUserAction({}, form({ name: "New user", username: "new-test", email: "new@example.test", password: "TemporaryTest123", confirmPassword: "TemporaryTest123", roleId: "perencana" }))).status, "success");
  const created = db.prepare("SELECT role_id, password_hash FROM users WHERE username = ?").get("new-test");
  assert.equal(created.role_id, "perencana"); assert.notEqual(created.password_hash, "TemporaryTest123");
  // Public registration must ignore attempts to supply privileged fields.
  await assert.rejects(() => load("@/actions/auth").registerAction({}, form({ name: "Registered user", username: "registered-test", email: "registered@example.test", password: "TemporaryTest123", confirmPassword: "TemporaryTest123", roleId: "administrator", protected_administrator: "1" })), /Redirect:\/dashboard\/akses/);
  assert.equal(currentUser().roleId, "unassigned"); assert.equal(currentUser().isAdministrator, false);
  for (const file of walk("src/app/api").filter(f => f.endsWith("route.ts"))) {
    const source = readFileSync(file, "utf8");
    if (!source.includes('export { POST }')) assert.equal((source.match(/export async function (?:GET|POST|DELETE|PATCH|PUT)/g) ?? []).length, (source.match(/const accessDenied = await checkApiAccess/g) ?? []).length, `${file} guard coverage`);
  }
  for (const file of walk("src/app/dashboard").filter(f => f.endsWith("page.tsx") && !["profile", "akses"].includes(path.basename(path.dirname(f))))) assert.match(readFileSync(file, "utf8"), /requireMenuAccess|getUserManagement/);
  console.log("User-management smoke passed: migration, preserved passwords, role inheritance, overrides, live revocation, API 401/403, action denial, no self escalation, protected administrator, account creation and registration, all page/API guards.");
} finally { db.close(); }
