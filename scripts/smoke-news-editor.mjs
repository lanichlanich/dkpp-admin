import assert from 'node:assert/strict';
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
assert.equal(new URL(base).hostname, '127.0.0.1', 'Gunakan pratinjau lokal.');
const home = await fetch(base, { redirect: 'manual' });
assert.equal(home.status, 200, 'Portal berita harus dapat diakses tanpa login');
const html = await home.text();
assert.match(html, /Ketahanan Pangan dan Pertanian/i);
assert.match(html, /\/login/);
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
