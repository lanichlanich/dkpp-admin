import "server-only";
import { randomUUID } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { database } from "@/lib/database";
import { getCurrentUser } from "@/lib/session";
import { canAccessMenu } from "@/lib/access-control";

export type NewsArticle = { id: string; slug: string; title: string; summary: string; category: string; bodyHtml: string; coverUrl: string; status: "draft" | "published"; publishedAt: string | null; updatedAt: string; revision: number };
type Input = Omit<NewsArticle, "id" | "slug" | "publishedAt" | "updatedAt" | "revision"> & { id?: string; revision?: number };
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
  return https(value) || /^\/(?:news|api\/news\/cover)\/[a-z\d_-][a-z\d_.-]*\.(?:webp|png|jpe?g|gif|avif)$/i.test(value);
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
const cols = "id, slug, title, summary, category, body_html AS bodyHtml, cover_url AS coverUrl, status, revision, published_at AS publishedAt, updated_at AS updatedAt";
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
export async function saveNews(input: Input): Promise<NewsArticle> {
  await requireNewsEditor();
  const title = input.title.trim(), summary = input.summary.trim(), category = input.category.trim() || "Umum", cover = input.coverUrl.trim();
  if (!title || title.length > 160 || summary.length > 320 || category.length > 60 || cover.length > 1000 || input.bodyHtml.length > 160000) throw new NewsValidationError("Periksa judul dan batas panjang isi berita.");
  if (input.status !== "draft" && input.status !== "published") throw new NewsValidationError("Status berita tidak valid.");
  if (cover && !imageUrl(cover)) throw new NewsValidationError("Gunakan URL gambar HTTPS yang valid.");
  const html = cleanHtml(input.bodyHtml);
  if (input.status === "published" && !sanitizeHtml(html, {allowedTags: [], allowedAttributes: {}}).replace(/&nbsp;|&#160;/g, " ").trim()) throw new NewsValidationError("Isi berita wajib diisi sebelum diterbitkan.");
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  if (input.id) {
    if (!Number.isSafeInteger(input.revision) || input.revision! < 1) throw new NewsValidationError("Versi berita tidak valid. Muat ulang halaman.");
    const result = await database.prepare(`UPDATE news_articles SET title=?, summary=?, category=?, body_html=?, cover_url=?, status=?, published_at=CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE NULL END, updated_at=?, revision=revision+1 WHERE id=? AND revision=?`).run(title, summary, category, html, cover, input.status, input.status, now, now, id, input.revision!);
    if (result.changes !== 1) throw new NewsValidationError("Berita telah berubah atau tidak tersedia. Salin suntingan Anda sebelum memuat ulang halaman.");
  } else {
    const base = title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 90).replace(/^-+|-+$/g, "") || "berita";
    const insert = database.prepare("INSERT INTO news_articles (id,slug,title,summary,category,body_html,cover_url,status,published_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT (slug) DO NOTHING");
    const values = [title, summary, category, html, cover, input.status, input.status === "published" ? now : null, now] as const;
    if (!(await insert.run(id, base, ...values)).changes && !(await insert.run(id, `${base}-${id}`, ...values)).changes) throw new NewsValidationError("Gagal membuat tautan berita.");
  }
  const row = await database.prepare(`SELECT ${cols} FROM news_articles WHERE id = ?`).get<NewsArticle>(id);
  if (!row) throw new NewsValidationError("Berita tidak ditemukan.");
  return normalize(row);
}
