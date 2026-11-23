import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const moduleUrl = new URL("../../lib/news-samples.ts", import.meta.url);

test("six distinct fictional news items have local SVG covers and substantive copy", async () => {
  assert.equal(await readFile(moduleUrl, "utf8").then(() => true, () => false), true, "sample catalog is missing");
  const { sampleNews } = await import(moduleUrl.href);
  assert.equal(sampleNews.length, 6);
  assert.equal(new Set(sampleNews.map(({ slug }) => slug)).size, 6);
  assert.equal(new Set(sampleNews.map(({ coverUrl }) => coverUrl)).size, 6);
  const artworks = [];
  for (const article of sampleNews) {
    assert.match(article.slug, /^contoh-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(article.title && article.summary && article.category);
    assert.match(article.bodyHtml, /<p>[^<]/);
    assert.ok(!Number.isNaN(Date.parse(article.publishedAt)));
    assert.match(article.coverUrl, /^\/news\/[a-z-]+\.svg$/);
    const svg = await readFile(new URL(`../../../public${article.coverUrl}`, import.meta.url), "utf8");
    assert.match(svg, /^<svg\b[^>]*viewBox=/);
    assert.match(svg, /<\/svg>\s*$/);
    artworks.push(svg);
  }
  assert.equal(new Set(artworks).size, 6);
});

const readerUrl = new URL("../../components/news/public-news-selection.ts", import.meta.url);

async function fixture(rows) {
  assert.equal(await readFile(readerUrl, "utf8").then(() => true, () => false), true, "public news reader is missing");
  const { createPublicNewsReader } = await import(readerUrl.href);
  const { sampleNews } = await import(moduleUrl.href);
  const [sample] = sampleNews;
  return {
    sample,
    ...createPublicNewsReader(
      async () => rows,
      async (slug) => rows.find((item) => item.slug === slug) ?? null,
      sampleNews,
    ),
  };
}

test("an empty public feed exposes only the clearly flagged sample articles", async () => {
  const { list, get, sample } = await fixture([]);
  assert.equal((await list()).length, 6);
  assert.ok((await list()).every((entry) => entry.isSample));
  assert.deepEqual(await get(sample.slug), { article: sample, isSample: true });
  assert.equal(await get("tidak-ada"), null);
});

test("published records replace all samples, and drafts are never rendered", async () => {
  const { sample } = await fixture([]);
  const published = { ...sample, slug: "berita-resmi", status: "published" };
  const draft = { ...sample, slug: "berita-rahasia", status: "draft" };
  const { list, get } = await fixture([published, draft]);
  assert.deepEqual(await list(), [{ article: published, isSample: false }]);
  assert.deepEqual(await get(published.slug), { article: published, isSample: false });
  assert.equal(await get(draft.slug), null);
  assert.equal(await get(sample.slug), null);
});

test("a published article takes precedence over a sample with the same slug", async () => {
  const { sample } = await fixture([]);
  const published = { ...sample, title: "Berita resmi", status: "published" };
  const { get } = await fixture([published]);
  assert.deepEqual(await get(sample.slug), { article: published, isSample: false });
});
