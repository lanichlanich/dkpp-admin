import assert from 'node:assert/strict';
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
assert.equal(new URL(base).hostname, '127.0.0.1', 'Gunakan pratinjau lokal.');
const home = await fetch(base, { redirect: 'manual' });
assert.equal(home.status, 200, 'Portal berita harus dapat diakses tanpa login');
const html = await home.text();
assert.match(html, /Ketahanan Pangan dan Pertanian/i);
assert.match(html, /\/login/);
const nav = html.match(/<nav aria-label="Navigasi publik">([\s\S]*?)<\/nav>/)?.[1] ?? '';
assert.match(nav, /<a\b[^>]*href="\/perpustakaan"[^>]*>Perpustakaan<\/a>/, 'Navigasi utama harus menautkan Perpustakaan');
assert.doesNotMatch(nav, /Open Data|Publikasi/i);
for (const section of ['profil', 'sotk', 'berita', 'galeri', 'kontak']) assert.ok(html.includes(`id="${section}"`), section);
const photos = [...new Set(Array.from(html.matchAll(/href="(\/galeri\/[a-z-]+\.webp)"/g), match => match[1]))];
assert.equal(photos.length, 12);
await Promise.all(photos.map(async photo => {
  const response = await fetch(base + photo);
  assert.equal(response.status, 200, photo);
  assert.match(response.headers.get('content-type'), /^image\/webp/);
  assert.equal(Buffer.from(await response.arrayBuffer()).toString('ascii', 8, 12), 'WEBP', photo);
}));
const library = await fetch(base + '/perpustakaan', { redirect: 'manual' });
assert.equal(library.status, 200, 'Katalog perpustakaan harus dapat dibuka tanpa login');
assert.match(await library.text(), /id="katalog"/);
const links = [...new Set(Array.from(html.matchAll(/href="(\/berita\/[^"?#]+)"/g), m => m[1]))];
assert.ok(links.length >= 6, 'Database kosong harus menampilkan enam artikel contoh');
for (const href of links.slice(0, 6)) {
  const article = await fetch(base + href);
  assert.equal(article.status, 200, href);
  assert.match(await article.text(), /contoh/i, 'Artikel contoh harus terlihat sebagai contoh');
}
const anonymous = await fetch(base + '/dashboard/berita', { redirect: 'manual' });
assert.equal(new URL(anonymous.headers.get('location'), base).pathname, '/login');
console.log('PASS: portal publik, enam artikel contoh, dan akses redaksi dilindungi');
