import assert from 'node:assert/strict';
const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3021';
for (const [path, expected] of Object.entries({ '/': ['Akses Cepat','/perpustakaan#katalog','id="sotk"','id="galeri"','id="kontak"','Jelajahi Katalog','Kategori galeri','id="galeri-4"'], '/perpustakaan': ['id="katalog"','Ringkasan koleksi','Tersedia saja','Hubungi petugas','Navigasi publik'] })) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  for (const item of expected) assert.ok(html.includes(item), `${path} needs ${item}`);
}
console.log('PASS public preview: responsive navigation, quick links, catalog and contact landmarks');
