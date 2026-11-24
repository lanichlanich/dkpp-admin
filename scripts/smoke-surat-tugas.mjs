import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import PizZip from 'pizzip';
const require = createRequire(import.meta.url);
const cache = new Map();
const first = '199001012024211001', second = '199001012024211002';
const staff = [
  { nip: first, name: 'Pegawai & Uji', rank: 'III/d / Penata Tk. I', position: 'Analis Uji' },
  { nip: second, name: 'Pegawai Kedua', rank: 'IX', position: 'Pelaksana Uji' },
];
let access = 401, signers = [{ nip: '198001012000011009', rank: 'IV/b / Pembina Tk. I' }];
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} };
  cache.set(file, mod.exports);
  const resolve = name => {
    if (name === 'server-only') return {};
    if (name === '@/lib/authorization') return { checkApiAccess: async menus => { assert.deepEqual(menus, ['surat-tugas']); return access ? new Response(null,{status:access}) : null; } };
    if (name === '@/lib/database') return { database: { prepare: sql => ({ all: (...values) => sql.includes('RORY') ? signers : staff.filter(row => values.includes(row.nip)) }) } };
    if (name.startsWith('@/')) return name.endsWith('.json') ? require(path.resolve('src',name.slice(2))) : load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  const code=ts.transpileModule(readFileSync(file,'utf8'),{ compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true} }).outputText;
  new Function('require','module','exports',code)(resolve,mod,mod.exports);
  cache.set(file,mod.exports);
  return mod.exports;
}
const { POST } = load('src/app/api/surat-tugas/generate/route.ts');
const url='https://example.test/api/surat-tugas/generate';
const valid={ nomor:'800/123/Sekre', tanggal:'2026-11-24', tempat:'Indramayu', dasar:['Surat undangan & lampiran'], tugas:['Menghadiri rapat <koordinasi>.','Menyampaikan laporan.'], employeeNips:[second,first], confirmSigner:true };
const send=(body, origin='https://example.test')=>POST(new Request(url,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
assert.equal((await send(valid)).status,401); access=403; assert.equal((await send(valid)).status,403); access=0;
assert.equal((await send(valid,'https://other.test')).status,403);
for(const body of [{...valid,employeeNips:[first,first]},{...valid,employeeNips:['999999999999999999']},{...valid,tanggal:'2026-02-30'},{...valid,confirmSigner:false},{...valid,dasar:[' ']},{...valid,tugas:['x'.repeat(601)]}]) assert.equal((await send(body)).status,422);
const saved=signers;signers=[];assert.equal((await send(valid)).status,422);signers=saved;
const response=await send({...valid,name:'Client forged identity'});
assert.equal(response.status,200); assert.match(response.headers.get('content-disposition'),/Surat-Tugas-2026-11-24\.docx/);assert.equal(response.headers.get('cache-control'),'private, no-store');
const buffer=Buffer.from(await response.arrayBuffer());const zip=new PizZip(buffer);const xml=zip.file('word/document.xml').asText();
for(const text of ['MEMERINTAHKAN:', '800/123/Sekre','24 November 2026','Pegawai &amp; Uji','Menghadiri rapat &lt;koordinasi&gt;.','${ttd_pengirim}','RORY FIRMANSYAH',first,second]) assert.ok(xml.includes(text),text);
assert.ok(xml.indexOf(second)<xml.indexOf(first)); assert.ok(!xml.includes('Client forged')&&!xml.includes('DRAF')&&!xml.includes('[['));assert.ok(Object.keys(zip.files).some(x=>x.startsWith('word/media/')&&!zip.files[x].dir));
if(process.env.SURAT_TUGAS_FIXTURE) writeFileSync(process.env.SURAT_TUGAS_FIXTURE,buffer);
console.log('PASS Surat Tugas: permissions, origin, validation, employee order, escaping and unsigned DOCX');
