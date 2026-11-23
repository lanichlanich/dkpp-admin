import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const workdir = mkdtempSync(path.join(tmpdir(), "dkpp-news-"));
const originalCwd = process.cwd();
const require = createRequire(import.meta.url);
const cache = new Map();
let cookie;
let pool;

function load(file) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "next/headers") return {
      cookies: async () => ({ get: (key) => key === "admin_session" && cookie ? { value: cookie } : undefined }),
      headers: async () => new Headers(cookie ? { cookie: `admin_session=${cookie}` } : {}),
    };
    if (!specifier.startsWith("@/")) return require(specifier);
    const source = `src/${specifier.slice(2)}`;
    return source.endsWith(".json") ? require(path.resolve(root, source)) : load(`${source}.ts`);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}

try {
  process.chdir(workdir);
  delete process.env.POSTGRES_URL;
  if (process.env.NEWS_TEST_POSTGRES_URL) {
    const url = new URL(process.env.NEWS_TEST_POSTGRES_URL);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.pathname, "/dkpp_news_smoke");
    assert.equal(url.username, "dkpp_news_test");
    process.env.POSTGRES_URL = url.toString();
  }
  const { canAccessPath, parseMenuPermissions } = load("src/lib/access-control.ts");
  assert.deepEqual(parseMenuPermissions('["berita"]'), ["berita"]);
  assert(canAccessPath({ isAdministrator: false, menuPermissions: ["berita"] }, "/dashboard/berita"));
  const { listNews, listPublishedNews, getPublishedNews, requireNewsEditor, saveNews } = load("src/lib/news.ts");
  const { database, createBackupSnapshot } = load("src/lib/database.ts");
  pool = globalThis.adminflowPostgresPool;
  const article = {
    title: "  Berita Uji Bersama  ", summary: "Ringkasan uji", category: "Kegiatan",
    bodyHtml: `<h2 style="text-align: center; color: red">Judul</h2><h3>Subjudul</h3><h4>Rincian</h4>
      <p style="text-align: right; background: red">Teks <strong>tebal</strong> <u>garis</u> <a href="https://example.test/">sumber</a>.</p>
      <ol start="2"><li><p>Butir</p></li></ol><blockquote><p>Kutipan</p></blockquote><pre><code>Contoh &lt;kode&gt;</code></pre>
      <table><tbody><tr><th colspan="2"><p>Judul</p></th></tr><tr><td><p>Isi</p></td></tr></tbody></table>
      <img src="/news/synthetic.webp" alt="Foto contoh"><img src="/api/news/cover/example.webp"><img src="https://example.test/img.png">`,
    coverUrl: " /news/cover.webp ", status: "draft",
  };
  assert.deepEqual(await listPublishedNews(), [], "No backend samples or drafts on a new database");
  assert.equal(await getPublishedNews("missing"), null);
  for (const action of [requireNewsEditor, listNews, () => saveNews(article)]) {
    await assert.rejects(action, { name: "NewsAccessError", status: 401 });
  }
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 60_000).toISOString();
  for (const [id, permissions, admin, active, expiry] of [
    ["guest", "[]", 0, 1, expires], ["editor", '["berita"]', 0, 1, expires], ["owner", "[]", 1, 1, expires],
    ["inactive", '["berita"]', 0, 0, expires], ["expired", '["berita"]', 0, 1, "2000-01-01T00:00:00.000Z"],
  ]) {
    await database.prepare("INSERT INTO app_roles (id, name, is_administrator, menu_permissions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, id, admin, permissions, now, now);
    await database.prepare("INSERT INTO users (id, name, username, email, password_hash, role_id, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, id, id, `${id}@example.test`, "unused", id, active, now, now);
    await database.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
      .run(createHash("sha256").update(id).digest("hex"), id, expiry, now);
  }
  for (const [session, status] of [["guest", 403], ["inactive", 401], ["expired", 401]]) {
    cookie = session;
    for (const action of [requireNewsEditor, listNews, () => saveNews(article)]) {
      await assert.rejects(action, { name: "NewsAccessError", status });
    }
  }
  cookie = "editor";
  const uploadImage = load("src/app/api/news/media/route.ts").POST;
  const getImage = load("src/app/api/news/media/[name]/route.ts").GET;
  const imageBytes = await require("sharp")({ create: { width: 8, height: 8, channels: 3, background: "#157454" } }).png().toBuffer();
  const uploadRequest = (bytes, origin = "http://localhost") => new Request("http://localhost/api/news/media", { method: "POST", headers: { "content-type": "image/png", origin }, body: bytes });
  cookie = undefined;
  assert.equal((await uploadImage(uploadRequest(imageBytes))).status, 401);
  cookie = "owner";
  assert.equal((await uploadImage(uploadRequest(imageBytes, "https://other.test"))).status, 403);
  assert.equal((await uploadImage(uploadRequest(Buffer.from("not png")))).status, 415);
  assert.equal((await uploadImage(uploadRequest(Buffer.alloc(2 * 1024 * 1024 + 1)))).status, 413);
  const uploaded = await uploadImage(uploadRequest(imageBytes));
  assert.equal(uploaded.status, 201);
  const { url } = await uploaded.json();
  const get = () => getImage(new Request(`http://localhost${url}`), { params: Promise.resolve({ name: url.split("/").at(-1) }) });
  assert.equal((await get()).headers.get("content-type"), "image/webp");
  const withImage = await saveNews({ ...article, coverUrl: url, bodyHtml: `<p>Isi</p><img src="${url}" alt="Gambar uji">` });
  cookie = undefined;
  assert.equal((await get()).status, 404);
  cookie = "owner";
  const liveImage = await saveNews({ ...withImage, revision: withImage.revision, coverUrl: "", status: "published" });
  assert.match(liveImage.bodyHtml, /Gambar uji/);
  cookie = undefined;
  const publicImage = await get();
  assert.equal(publicImage.status, 200);
  assert.equal(Buffer.from(await publicImage.arrayBuffer()).toString("ascii", 8, 12), "WEBP");
  cookie = "owner";
  await load("src/lib/news.ts").deleteNews(liveImage.id, liveImage.revision);
  cookie = undefined;
  assert.equal((await get()).status, 404);
  cookie = "editor";
  const { saveNewsTerm, listNewsTerms, deleteNewsTerm, deleteNews } = load("src/lib/news.ts");
  const tag = await saveNewsTerm("tag", "Panen");
  await assert.rejects(() => saveNewsTerm("tag", "panen"), { name: "NewsValidationError" });
  const category = await saveNewsTerm("category", "Hortikultura");
  assert((await listNewsTerms()).some(row => row.id === category.id));
  const tagged = await saveNews({ ...article, category: "Hortikultura", tagIds: [tag.id] });
  assert.deepEqual(await load("src/lib/news.ts").getNewsTagIds(tagged.id), [tag.id]);
  await assert.rejects(() => deleteNews(tagged.id, tagged.revision + 1), { name: "NewsValidationError" });
  await assert.rejects(() => deleteNewsTerm("category", category.id), { name: "NewsValidationError" });
  await saveNewsTerm("category", "Horti", category.id, "Hortikultura");
  assert.equal((await listNews()).find(row => row.id === tagged.id).category, "Horti");
  await assert.rejects(() => saveNewsTerm("category", "Lama", category.id, "Hortikultura"), { name: "NewsValidationError" });
  await assert.rejects(() => saveNews({ ...article, id: tagged.id, revision: tagged.revision, tagIds: ["12345678-1234-1234-1234-123456789012"] }), { name: "NewsValidationError" });
  assert.deepEqual(await load("src/lib/news.ts").getNewsTagIds(tagged.id), [tag.id]);
  await deleteNews(tagged.id, tagged.revision);
  assert.deepEqual(await load("src/lib/news.ts").getNewsTagIds(tagged.id), []);
  await deleteNewsTerm("tag", tag.id);
  await deleteNewsTerm("category", category.id);
  assert.equal((await requireNewsEditor()).id, "editor");
  assert.deepEqual(await listNews(), []);
  const draft = await saveNews(article);
  assert.deepEqual(Object.keys(draft).sort(), ["id", "slug", "title", "summary", "category", "bodyHtml", "coverUrl", "publishedAt", "revision", "status", "updatedAt"].sort());
  assert.equal(draft.title, "Berita Uji Bersama");
  assert.equal(draft.slug, "berita-uji-bersama");
  assert.equal(draft.coverUrl, "/news/cover.webp");
  assert.equal(draft.publishedAt, null);
  assert.match(draft.updatedAt, /Z$/);
  for (const fragment of ['<h2 style="text-align:center">', '<h3>', '<h4>', '<p style="text-align:right">', '<strong>', '<u>', '<a href="https://example.test/">', '<ol start="2">', '<blockquote>', '<pre><code>', '<table>', '<th colspan="2">', '<img src="/news/synthetic.webp" alt="Foto contoh"', '<img src="/api/news/cover/example.webp"', '<img src="https://example.test/img.png"']) assert(draft.bodyHtml.includes(fragment), fragment);
  assert.doesNotMatch(draft.bodyHtml, /color:|background:/);
  assert.deepEqual(await listNews(), [draft]);
  const duplicate = await saveNews(article);
  assert.notEqual(duplicate.slug, draft.slug);
  const competing = await Promise.all([saveNews({ ...article, title: "Simultan" }), saveNews({ ...article, title: "Simultan" })]);
  assert.equal(new Set(competing.map(({ slug }) => slug)).size, 2);
  await assert.rejects(() => saveNews({ ...article, id: "missing" }));
  for (const coverUrl of ["http://example.test/a.png", "//example.test/a.png", "/news/../private.png", "/news/%2e%2e/private.png", "/news/a%2fb.png", "/news/asset.svg", "/other/asset.png", "https://user@example.test/a.png", "https:example.test/a.png"]) {
    await assert.rejects(() => saveNews({ ...article, coverUrl }));
  }
  await assert.rejects(() => saveNews({ ...article, status: "hidden" }));
  await assert.rejects(() => saveNews({ ...article, status: "published", bodyHtml: "<p> &nbsp; </p>" }));
  const published = await saveNews({ ...article, id: draft.id, revision: draft.revision, title: "Judul baru", status: "published", coverUrl: "https://example.test/cover.png", bodyHtml:
    '<h2 style="text-align:justify">Aman</h2><p style="text-align: left !important">Teks</p><script>UNSAFE</script><style>UNSAFE</style><iframe src="https://example.test"></iframe><svg><text>UNSAFE</text></svg><img src="/other/local.png"><img src="/news/valid.png" onerror="X" srcset="X"><a href="mailto:test@example.test" target="_blank">surel</a>' });
  assert.equal(published.slug, draft.slug);
  assert.match(published.publishedAt, /Z$/);
  assert.match(published.bodyHtml, /text-align:justify/);
  assert.match(published.bodyHtml, /<img src="\/news\/valid\.png"/);
  assert.doesNotMatch(published.bodyHtml, /UNSAFE|<svg|iframe|onerror|srcset|\/other\/|mailto|target=|important/);
  const same = await saveNews({ ...article, id: draft.id, revision: published.revision, status: "published" });
  assert.equal(same.publishedAt, published.publishedAt);
  const newer = await saveNews({ ...article, id: duplicate.id, revision: duplicate.revision, status: "published" });
  cookie = undefined;
  assert.deepEqual(await listPublishedNews(), [newer, same]);
  assert.deepEqual(await getPublishedNews(draft.slug), same);
  assert.equal(await getPublishedNews(competing[0].slug), null);
  cookie = "owner";
  const unpublished = await saveNews({ ...article, id: draft.id, revision: same.revision, coverUrl: "/api/news/cover/example.webp" });
  assert.equal(unpublished.publishedAt, null);
  await assert.rejects(() => saveNews({ ...article, id: draft.id, revision: same.revision, status: "published" }), { name: "NewsValidationError" });
  await assert.rejects(() => saveNews({ ...article, id: draft.id, status: "published" }), { name: "NewsValidationError" });
  assert.equal(await getPublishedNews(draft.slug), null);
  assert.equal((await listNews()).length, 4);
  assert((await database.prepare("SELECT entity FROM audit_logs").all()).some((row) => row.entity === "news_articles"));
  if (!process.env.POSTGRES_URL) {
    assert.equal((await createBackupSnapshot()).tables.news_articles.length, 4);
    const { db } = load("src/lib/db.ts");
    assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  }
  console.log(`PASS news (${process.env.POSTGRES_URL ? "PostgreSQL" : "SQLite"}): permissions and real sessions, drafts/publication, stable distinct slugs, sorting, HTML/URL policy, and audit`);
} finally {
  if (pool) await pool.end();
  if (cache.has(path.resolve(root, "src/lib/db.ts"))) cache.get(path.resolve(root, "src/lib/db.ts")).exports.db?.close();
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
}
