import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import Database from "better-sqlite3";
import { compare, getRounds, hash } from "bcryptjs";
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
  if (name === "@/lib/session") return { getCurrentUser: async () => currentUser(), requireUser: async () => { const user = currentUser(); if (!user) throw new Error("Unauthorized"); return user; }, createSession: async id => { actorId = id; }, deleteSession: async () => { actorId = ""; } };
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
  const originalPlanner = db.prepare("SELECT * FROM users WHERE id = ?").get("planner-test");
  assert.equal((await actions.editUserAction({}, form({ id: "planner-test", name: "  Perencana Baru  ", username: "planner-updated", email: "PLANNER.NEW@example.test", roleId: "administrator", password: "ChangedPassword123", is_active: "0" }))).status, "success");
  const editedPlanner = db.prepare("SELECT * FROM users WHERE id = ?").get("planner-test");
  assert.equal(editedPlanner.name, "Perencana Baru");
  assert.equal(editedPlanner.username, "planner-updated");
  assert.equal(editedPlanner.email, "planner.new@example.test");
  for (const key of ["id", "password_hash", "role_id", "menu_permissions", "is_active", "protected_administrator", "created_at"]) assert.equal(editedPlanner[key], originalPlanner[key], `Edit must preserve ${key}`);
  const edit = overrides => form({ id: "planner-test", name: "Perencana Baru", username: "planner-updated", email: "planner.new@example.test", ...overrides });
  assert.equal((await actions.editUserAction({}, edit({ username: "ADMIN1" }))).status, "error");
  assert.equal((await actions.editUserAction({}, edit({ email: "ADMIN1@DKPP.COM" }))).status, "error");
  assert.equal((await actions.editUserAction({}, edit({ email: "invalid" }))).status, "error");
  assert.equal((await actions.editUserAction({}, edit({ username: "bad username" }))).status, "error");
  assert.equal((await actions.editUserAction({}, edit({ id: "missing-user" }))).status, "error");
  assert.equal((await actions.editUserAction({}, form({ id: "admin-test", name: "Admin", username: "admin1", email: "changed@example.test" }))).status, "error");
  const oldSecret = "OldTestSecret123", newSecret = "NewTestSecret123!";
  const oldHash = await hash(oldSecret, 4);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(oldHash, "planner-test");
  const insertSession = db.prepare("INSERT INTO sessions VALUES (?,?,?,?)");
  insertSession.run("planner-session-1", "planner-test", now, now);
  insertSession.run("planner-session-2", "planner-test", now, now);
  insertSession.run("admin-session", "admin-test", now, now);
  const sessionCount = id => db.prepare("SELECT count(*) AS total FROM sessions WHERE user_id = ?").get(id).total;
  const storedHash = () => db.prepare("SELECT password_hash FROM users WHERE id = ?").get("planner-test").password_hash;
  assert.equal((await actions.editUserAction({}, edit({ newPassword: "", confirmNewPassword: "" }))).status, "success");
  assert.equal(storedHash(), oldHash); assert.equal(sessionCount("planner-test"), 2);
  for (const [newPassword, confirmNewPassword] of [["short1", "short1"], ["lettersOnly", "lettersOnly"], [newSecret, "different"], ["", newSecret], ["é".repeat(36) + "A1", "é".repeat(36) + "A1"]]) {
    assert.equal((await actions.editUserAction({}, edit({ newPassword, confirmNewPassword }))).status, "error");
    assert.equal(storedHash(), oldHash); assert.equal(sessionCount("planner-test"), 2);
  }
  db.exec("CREATE TEMP TRIGGER reject_test_session_delete BEFORE DELETE ON sessions WHEN OLD.user_id = 'planner-test' BEGIN SELECT RAISE(ABORT, 'Simulated session failure'); END");
  assert.equal((await actions.editUserAction({}, edit({ name: "Must roll back", newPassword: newSecret, confirmNewPassword: newSecret }))).status, "error");
  assert.equal(storedHash(), oldHash); assert.equal(sessionCount("planner-test"), 2);
  assert.equal(db.prepare("SELECT name FROM users WHERE id = ?").get("planner-test").name, "Perencana Baru");
  db.exec("DROP TRIGGER reject_test_session_delete");
  const passwordResult = await actions.editUserAction({}, edit({ newPassword: newSecret, confirmNewPassword: newSecret }));
  assert.equal(passwordResult.status, "success");
  assert(await compare(newSecret, storedHash())); assert.equal(await compare(oldSecret, storedHash()), false);
  assert.equal(getRounds(storedHash()), 12); assert.equal(sessionCount("planner-test"), 0); assert.equal(sessionCount("admin-test"), 1);
  assert(!JSON.stringify(passwordResult).includes(newSecret)); assert(!JSON.stringify(passwordResult).includes(storedHash()));
  assert(!JSON.stringify(await load("@/lib/user-management").getUserManagement()).includes(storedHash()));
  assert.equal((await actions.saveUserAccessAction({}, form({ id: "admin-test", roleId: "perencana", active: "on" }))).status, "error");
  assert.equal((await actions.saveUserAccessAction({}, form({ id: "admin-test", roleId: "administrator" }))).status, "error");
  assert.equal((await actions.saveRoleAction({}, form({ id: "administrator", name: "Hacked", menus: ["pembuatan-kak"] }))).status, "error");
  assert.equal((await actions.saveUserAccessAction({}, form({ id: "planner-test", roleId: "perencana", active: "on" }))).status, "success");
  actorId = "planner-test";
  await assert.rejects(() => actions.editUserAction({}, edit({ id: "admin-test", email: "changed@example.test" })), /administrator/);
  await assert.rejects(() => actions.editUserAction({}, edit({ newPassword: "Unauthorized123", confirmNewPassword: "Unauthorized123" })), /administrator/);
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
  await assert.rejects(() => actions.editUserAction({}, form({ id: "admin-test", name: "Admin", username: "admin1", email: "admin1@dkpp.com", newPassword: "AdminTestSecret123", confirmNewPassword: "AdminTestSecret123" })), /Redirect:\/login$/);
  assert.equal(actorId, ""); assert.equal(sessionCount("admin-test"), 0);
  actorId = "admin-test";
  assert(currentUser().isAdministrator); assert(currentUser().protectedAdministrator);
  // Public registration must ignore attempts to supply privileged fields.
  await assert.rejects(() => load("@/actions/auth").registerAction({}, form({ name: "Registered user", username: "registered-test", email: "registered@example.test", password: "TemporaryTest123", confirmPassword: "TemporaryTest123", roleId: "administrator", protected_administrator: "1" })), /Redirect:\/dashboard\/akses/);
  assert.equal(currentUser().roleId, "unassigned"); assert.equal(currentUser().isAdministrator, false);
  for (const file of walk("src/app/api").filter(f => f.endsWith("route.ts"))) {
    const source = readFileSync(file, "utf8");
    if (!source.includes('export { POST }')) {
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      for (const declaration of ast.statements.filter(node => ts.isFunctionDeclaration(node) && /^(GET|POST|DELETE|PATCH|PUT)$/.test(node.name?.text ?? "")))
        assert.match(declaration.body?.getText(ast) ?? "", /await checkApiAccess\(/, `${file} ${declaration.name.text} guard coverage`);
    }
  }
  for (const file of walk("src/app/dashboard").filter(f => f.endsWith("page.tsx") && !["profile", "akses"].includes(path.basename(path.dirname(f))))) assert.match(readFileSync(file, "utf8"), /requireMenuAccess|getUserManagement/);
  console.log("User-management smoke passed: optional password update, bcrypt login verification, confirmation/length validation, atomic rollback and session revocation, self-reset logout, credential privacy, administrator protection, roles and all page/API guards.");
} finally { db.close(); }
