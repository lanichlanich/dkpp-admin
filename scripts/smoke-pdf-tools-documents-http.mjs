import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { join } from "node:path";
import Database from "better-sqlite3";
import { PDFDocument } from "pdf-lib";

const base = new URL(process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname), "Use the local SQLite preview only");
const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  return next(specifier === "./pdf-tools-config" ? "./pdf-tools-config.ts" : specifier, context);
} });
const { savePdfToolDocuments } = await import("../src/lib/pdf-tools-documents.ts");
hook.deregister();
const db = new Database(join(process.cwd(), "data", "admin.db"), { fileMustExist: true });
db.pragma("foreign_keys = ON");
const hash = value => createHash("sha256").update(value).digest("hex");
const now = new Date().toISOString();
const expires = new Date(Date.now() + 300_000).toISOString();
const ids = [];
function user(permissions, administrator = 0) {
  const roleId = db.prepare("SELECT id FROM app_roles WHERE is_administrator = ? LIMIT 1").get(administrator)?.id;
  assert.ok(roleId, "A matching test role must exist");
  const id = `smoke-pdf-${randomUUID()}`;
  const token = randomBytes(32).toString("base64url");
  ids.push(id);
  db.prepare(`INSERT INTO users (id, name, username, email, password_hash, created_at, updated_at, role_id, menu_permissions, is_active)
    VALUES (?, 'Smoke PDF', ?, ?, 'unused', ?, ?, ?, ?, 1)`).run(id, id, `${id}@example.test`, now, now, roleId, JSON.stringify(permissions));
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(hash(token), id, expires, now);
  return { id, cookie: `admin_${"session"}=${token}` };
}
function request(url, user, method = "GET", payload, origin = base.origin) {
  return fetch(new URL(url, base), { method, redirect: "manual", headers: {
    ...(user ? { Cookie: user.cookie } : {}),
    ...(method !== "GET" ? { Origin: origin } : {}),
    ...(payload !== undefined ? { "Content-Type": "application/json" } : {}),
  }, body: payload === undefined ? undefined : JSON.stringify(payload) });
}
async function expectStatus(response, expected) {
  assert.equal(response.status, expected, `${response.url} returned ${response.status}; ${response.status !== expected ? (await response.text()).slice(0, 500) : ""}`);
  return response;
}

try {
  const owner = user(["pdf-tools-documents"]);
  const other = user(["pdf-tools-documents"]);
  const administrator = user([], 1);
  const operationOnly = user(["compress-pdf"]);
  const testId = randomUUID();
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const pdfBytes = Buffer.from(await pdf.save());
  const save = (who, name) => savePdfToolDocuments(who.id, "compress", [{ name, bytes: pdfBytes, pages: 1 }]);
  const title = `Pemilik ${testId}.pdf`;
  const otherTitle = `Pengguna Lain ${testId}.pdf`;
  const [[doc], [otherDoc], [operationDoc]] = await Promise.all([
    save(owner, title), save(other, otherTitle), save(operationOnly, "Kompres Tanpa Riwayat.pdf"),
  ]);
  const documentUrl = `/api/tools/documents/${doc.id}`;
  const pageUrl = "/dashboard/tools/daftar-dokumen";
  await expectStatus(await request(documentUrl), 401);
  for (const method of ["GET", "PATCH", "DELETE"]) {
    const body = method === "PATCH" ? { name: "Bukan Milik Anda" } : undefined;
    await expectStatus(await request(documentUrl, other, method, body), 404);
    await expectStatus(await request(documentUrl, administrator, method, body), 404);
    await expectStatus(await request(`/api/tools/documents/${operationDoc.id}`, operationOnly, method, body), 403);
  }
  const deniedPage = await request(pageUrl, operationOnly);
  if (deniedPage.status === 200) {
    // Next can start streaming the dashboard shell before emitting the redirect.
    const html = await deniedPage.text();
    assert.match(html, /NEXT_REDIRECT[^<]+\/dashboard\/tools\/compress-pdf/);
    assert.ok(!html.includes("Kompres Tanpa Riwayat.pdf"));
  } else {
    assert.ok([303, 307, 308].includes(deniedPage.status), `List without history permission returned ${deniedPage.status}`);
  }
  const body = await (await expectStatus(await request(pageUrl, owner), 200)).text();
  assert.ok(body.includes("Daftar Dokumen") && body.includes(title));
  assert.ok(!body.includes(otherTitle) && !body.includes(otherDoc.id));
  const otherPage = await (await expectStatus(await request(pageUrl, other), 200)).text();
  assert.ok(otherPage.includes(otherTitle) && !otherPage.includes(title));
  const attachment = await expectStatus(await request(documentUrl, owner), 200);
  assert.equal(attachment.headers.get("content-type"), "application/pdf");
  assert.match(attachment.headers.get("content-disposition"), /^attachment;/);
  assert.match(attachment.headers.get("cache-control"), /private, no-store/);
  assert.deepEqual(Buffer.from(await attachment.arrayBuffer()), pdfBytes);
  await expectStatus(await request(documentUrl, owner, "PATCH", { name: "x" }, "https://untrusted.example"), 403);
  await expectStatus(await request(documentUrl, owner, "DELETE", undefined, "https://untrusted.example"), 403);
  await expectStatus(await request(documentUrl, owner, "PATCH", { name: "x".repeat(2100) }), 413);
  await expectStatus(await request(documentUrl, owner, "PATCH", { name: "../hidden.pdf" }), 400);
  await expectStatus(await request(documentUrl, owner, "PATCH", { name: "x", ownerId: other.id }), 400);
  const renamed = await expectStatus(await request(documentUrl, owner, "PATCH", { name: "Dokumén 'baru'" }), 200);
  assert.equal((await renamed.json()).document.name, "Dokumén 'baru'.pdf");
  const download = await expectStatus(await request(documentUrl, owner), 200);
  assert.match(download.headers.get("content-disposition"), /filename\*=UTF-8''Dokum%C3%A9n%20%27baru%27\.pdf/);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdfBytes);
  await expectStatus(await request(documentUrl, owner, "DELETE"), 204);
  await expectStatus(await request(documentUrl, owner), 404);
  await expectStatus(await request(documentUrl, owner, "DELETE"), 404);
  const after = await (await expectStatus(await request(pageUrl, owner), 200)).text();
  assert.ok(!after.includes(doc.id));
  await expectStatus(await request(`/api/tools/documents/${otherDoc.id}`, other), 200);
  console.log("PASS PDF archive HTTP: private list, viewer permission, administrator isolation, attachment, CSRF, validation, rename and delete");
} finally {
  for (const id of ids) {
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    await rm(join(process.cwd(), "data", "pdf-tools-documents", hash(id)), { recursive: true, force: true });
  }
  db.close();
}
