import "server-only";
import { randomUUID } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { database, TransactionConflict } from "@/lib/database";
import { getCurrentUser } from "@/lib/session";
import { newsImageExists } from "@/lib/news-media";
import { NEWS_MEDIA_PREFIX, newsMediaNamePattern, newsMediaNames } from "@/lib/news-media-types";
import { canAccessMenu } from "@/lib/access-control";

export type NewsArticle = { id: string; slug: string; title: string; summary: string; category: string; bodyHtml: string; coverUrl: string; status: "draft" | "published"; publishedAt: string | null; updatedAt: string; revision: number };
type Input = Omit<NewsArticle, "id" | "slug" | "publishedAt" | "updatedAt" | "revision"> & { id?: string; revision?: number; categoryId?: string; tagIds?: string[] };
class NewsAccessError extends Error { name = "NewsAccessError"; constructor(public status: number) { super("Akses redaksi tidak tersedia."); } }
class NewsValidationError extends Error { name = "NewsValidationError"; }

export async function requireNewsEditor() {
  const user = await getCurrentUser();
  if (!user) throw new NewsAccessError(401);
  if (!canAccessMenu(user, "berita")) throw new NewsAccessError(403);
  return user;
}
function https(value: string) {
  if (!/^https:\/\//i.test(value) || /[\s\\\u0000-\u001f]/.test(value)) return false;
  try { const url = new URL(value); return !!url.hostname && !url.username && !url.password; } catch { return false; }
}
function imageUrl(value: string) {
  if (value.startsWith(NEWS_MEDIA_PREFIX)) return newsMediaNamePattern.test(value.slice(NEWS_MEDIA_PREFIX.length));
  return https(value) || /^\/(?:news|api\/news\/cover)\/[a-z\d_-][a-z\d_.-]*\.(?:webp|png|jpe?g|gif|avif)$/i.test(value);
}
export async function isPublishedNewsImage(name: string) {
  if (!newsMediaNamePattern.test(name)) return false;
  const url = `${NEWS_MEDIA_PREFIX}${name}`;
  const records = await database.prepare("SELECT cover_url AS cover, body_html AS body FROM news_articles WHERE status = 'published' AND (cover_url = ? OR body_html LIKE ?)").all<{ cover: string; body: string }>(url, `%${url}%`);
  return records.some(({ cover, body }) => newsMediaNames(cover, body).includes(name));
}
function cleanHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p","h2","h3","h4","br","hr","strong","b","em","i","u","s","strike","ul","ol","li","blockquote","code","pre","a","img","table","thead","tbody","tr","th","td"],
    allowedAttributes: { a:["href"], img:["src","alt","title"], ol:["start"], th:["colspan","rowspan"], td:["colspan","rowspan"], p:["style"], h2:["style"], h3:["style"], h4:["style"] },
    allowedStyles: { "*": { "text-align": [/^(left|right|center|justify)$/] } },
    allowedSchemes: ["https"], allowProtocolRelative: false,
    nonTextTags: ["script", "style", "textarea", "option", "svg", "iframe"], nestingLimit: 30,
    exclusiveFilter: frame => frame.tag === "img" && !imageUrl(frame.attribs.src || ""),
    transformTags: { "*": (tagName, attrs) => ({ tagName, attribs: { ...attrs, ...(attrs.style?.includes("!") ? {style:""} : {}) } }), img: (_tag, attrs) => ({ tagName: "img", attribs: { ...attrs, ...(imageUrl(attrs.src || "") ? {} : { src: "" }) } }), a: (_tag, attrs) => ({ tagName:"a", attribs: https(attrs.href || "") ? { href:attrs.href } : ({} as Record<string, string>) }) },
  });
}
const cols = "id, slug, title, summary, COALESCE((SELECT name FROM news_categories WHERE id = news_articles.category_id), category) AS category, body_html AS bodyHtml, cover_url AS coverUrl, status, revision, published_at AS publishedAt, updated_at AS updatedAt";
const normalize = (row: NewsArticle): NewsArticle => ({ ...row, publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null, updatedAt: new Date(row.updatedAt).toISOString() });
export async function listNews() {
  await requireNewsEditor();
  return (await database.prepare(`SELECT ${cols} FROM news_articles ORDER BY updated_at DESC, id DESC`).all<NewsArticle>()).map(normalize);
}
export async function listPublishedNews() {
  return (await database.prepare(`SELECT ${cols} FROM news_articles WHERE status = 'published' ORDER BY published_at DESC, updated_at DESC, id DESC`).all<NewsArticle>()).map(normalize);
}
export async function getPublishedNews(slug: string) {
  const row = await database.prepare(`SELECT ${cols} FROM news_articles WHERE slug = ? AND status = 'published'`).get<NewsArticle>(slug);
  return row ? normalize(row) : null;
}
export type NewsTermKind = "category" | "tag";
export type NewsTerm = { id: string; name: string; usage: number };
const termTable = (kind: NewsTermKind) => kind === "category" ? "news_categories" : "news_tags";
const nameKey = (name: string) => name.normalize("NFKC").toLowerCase();
export async function listNewsTerms(kind?: NewsTermKind): Promise<NewsTerm[]> {
  await requireNewsEditor();
  if (!kind) return (await Promise.all([listNewsTerms("category"), listNewsTerms("tag")])).flat();
  const count = kind === "category" ? "SELECT COUNT(*) FROM news_articles WHERE category_id = t.id" : "SELECT COUNT(*) FROM news_article_tags WHERE tag_id = t.id";
  return (await database.prepare(`SELECT id, name, (${count}) AS usage FROM ${termTable(kind)} t ORDER BY name`).all<NewsTerm>()).map(term => ({...term, usage: Number(term.usage)}));
}
export async function saveNewsTerm(kind: NewsTermKind, rawName: string, id?: string, previousName?: string) {
  await requireNewsEditor();
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name || name.length > 60 || id === "default") throw new NewsValidationError("Nama harus berisi 1–60 karakter; kategori Umum tidak dapat diubah.");
  const table = termTable(kind);
  const key = nameKey(name);
  const termId = id || randomUUID();
  try {
    if (id) {
      await database.transaction([{ sql: `UPDATE ${table} SET name = ?, name_key = ? WHERE id = ? AND name = ?`, values: [name, key, id, previousName ?? ""], expectChanges: 1 },
        ...(kind === "category" ? [{ sql: "UPDATE news_articles SET category = ? WHERE category_id = ?", values: [name, id] }] : [])]);
    } else {
      const result = await database.prepare(`INSERT INTO ${table} (id, name, name_key) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`).run(termId, name, key);
      if (!result.changes) throw new NewsValidationError("Nama tersebut sudah digunakan.");
    }
  } catch (error) {
    if (error instanceof TransactionConflict) throw new NewsValidationError("Data sudah berubah. Muat ulang halaman.");
    if (constraint(error, ["23505", "SQLITE_CONSTRAINT_UNIQUE"])) throw new NewsValidationError("Nama tersebut sudah digunakan.");
    throw error;
  }
  return { id: termId, name };
}
function constraint(error: unknown, codes: string[]) {
  return error instanceof Error && "code" in error && codes.includes(String(error.code));
}
export async function deleteNewsTerm(kind: NewsTermKind, id: string) {
  await requireNewsEditor();
  if (id === "default") throw new NewsValidationError("Kategori Umum tidak dapat dihapus.");
  try {
    const result = await database.prepare(`DELETE FROM ${termTable(kind)} WHERE id = ?`).run(id);
    if (!result.changes) throw new NewsValidationError("Data tidak ditemukan.");
  } catch (error) {
    if (constraint(error, ["23503", "23001", "SQLITE_CONSTRAINT_FOREIGNKEY", "SQLITE_CONSTRAINT_TRIGGER"])) throw new NewsValidationError("Kategori masih dipakai. Pindahkan beritanya terlebih dahulu.");
    throw error;
  }
}
export async function getNewsTagIds(id: string) {
  await requireNewsEditor();
  return (await database.prepare("SELECT tag_id AS tagId FROM news_article_tags WHERE article_id = ? ORDER BY tag_id").all<{ tagId: string }>(id)).map(({tagId}) => tagId);
}
export async function getNewsForEdit(id: string) {
  await requireNewsEditor();
  const row = await database.prepare(`SELECT ${cols}, category_id AS categoryId FROM news_articles WHERE id = ?`).get<NewsArticle & { categoryId: string | null }>(id);
  return row && { ...normalize(row), categoryId: row.categoryId ?? "default" };
}
export async function deleteNews(id: string, revision: number) {
  await requireNewsEditor();
  if (!Number.isSafeInteger(revision) || revision < 1) throw new NewsValidationError("Revisi tidak valid.");
  const result = await database.prepare("DELETE FROM news_articles WHERE id = ? AND revision = ?").run(id, revision);
  if (!result.changes) throw new NewsValidationError("Berita sudah berubah atau dihapus. Muat ulang daftar.");
}

export async function saveNews(input: Input): Promise<NewsArticle> {
  await requireNewsEditor();
  const title = input.title.trim(), summary = input.summary.trim(), category = input.category.trim() || "Umum", cover = input.coverUrl.trim();
  if (!title || title.length > 160 || summary.length > 320 || category.length > 60 || cover.length > 1000 || input.bodyHtml.length > 160000) throw new NewsValidationError("Periksa judul dan batas panjang isi berita.");
  if (input.status !== "draft" && input.status !== "published") throw new NewsValidationError("Status berita tidak valid.");
  if (cover && !imageUrl(cover)) throw new NewsValidationError("Gunakan URL gambar HTTPS yang valid.");
  const html = cleanHtml(input.bodyHtml);
  if (!(await Promise.all(newsMediaNames(cover, html).map(newsImageExists))).every(Boolean)) throw new NewsValidationError("Gambar unggahan tidak ditemukan. Unggah ulang sebelum menyimpan.");
  if (input.status === "published" && !sanitizeHtml(html, {allowedTags: [], allowedAttributes: {}}).replace(/&nbsp;|&#160;/g, " ").trim()) throw new NewsValidationError("Isi berita wajib diisi sebelum diterbitkan.");
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const term = input.categoryId
    ? await database.prepare("SELECT id, name FROM news_categories WHERE id = ?").get<{ id: string; name: string }>(input.categoryId)
    : await database.prepare("SELECT id, name FROM news_categories WHERE name_key = ?").get<{ id: string; name: string }>(nameKey(category));
  if (input.categoryId && !term) throw new NewsValidationError("Kategori tidak ditemukan.");
  const tagIds = input.tagIds === undefined ? undefined : [...new Set(input.tagIds)];
  if (tagIds && (tagIds.length > 20 || tagIds.some(tag => !/^[a-f0-9-]{36}$/i.test(tag)))) throw new NewsValidationError("Pilih maksimal 20 tag yang valid.");
  const tagStatements = tagIds === undefined ? [] : [
    { sql: "DELETE FROM news_article_tags WHERE article_id = ?", values: [id] },
    ...tagIds.map(tag => ({ sql: "INSERT INTO news_article_tags (article_id, tag_id) VALUES (?, ?)", values: [id, tag] })),
  ];
  try {
    if (input.id) {
      if (!Number.isSafeInteger(input.revision) || input.revision! < 1) throw new NewsValidationError("Versi berita tidak valid. Muat ulang halaman.");
      await database.transaction([{
        sql: `UPDATE news_articles SET title=?, summary=?, category=?, category_id=?, body_html=?, cover_url=?, status=?, published_at=CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE NULL END, updated_at=?, revision=revision+1 WHERE id=? AND revision=?`,
        values: [title, summary, term?.name ?? category, term?.id ?? null, html, cover, input.status, input.status, now, now, id, input.revision!], expectChanges: 1,
      }, ...tagStatements]);
    } else {
      const base = title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 90).replace(/^-+|-+$/g, "") || "berita";
      const insert = (slug: string) => database.transaction([{
        sql: "INSERT INTO news_articles (id,slug,title,summary,category,category_id,body_html,cover_url,status,published_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (slug) DO NOTHING",
        values: [id, slug, title, summary, term?.name ?? category, term?.id ?? null, html, cover, input.status, input.status === "published" ? now : null, now], expectChanges: 1,
      }, ...tagStatements]);
      try { await insert(base); } catch (error) {
        if (!(error instanceof TransactionConflict)) throw error;
        await insert(`${base}-${id}`);
      }
    }
  } catch (error) {
    if (error instanceof TransactionConflict) throw new NewsValidationError("Berita telah berubah atau tidak tersedia. Salin suntingan Anda sebelum memuat ulang halaman.");
    if (constraint(error, ["23503", "SQLITE_CONSTRAINT_FOREIGNKEY"])) throw new NewsValidationError("Kategori atau tag sudah dihapus. Muat ulang daftar pilihan.");
    throw error;
  }
  const row = await database.prepare(`SELECT ${cols} FROM news_articles WHERE id = ?`).get<NewsArticle>(id);
  if (!row) throw new NewsValidationError("Berita tidak ditemukan.");
  return normalize(row);
}
