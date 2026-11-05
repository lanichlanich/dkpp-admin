import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import Database from 'better-sqlite3';
import PizZip from 'pizzip';
import { PDFDocument } from 'pdf-lib';
import ts from 'typescript';

const require = createRequire(import.meta.url), db = new Database(':memory:'), cache = new Map(), objects = new Map();
db.pragma('foreign_keys=ON');
db.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT); INSERT INTO users VALUES('editor','Editor'),('other','Other'); CREATE TABLE employees(nip TEXT PRIMARY KEY,name TEXT,asn_type TEXT,status TEXT);");
const source = readFileSync('src/lib/db.ts','utf8');
for (const table of ['kgb_documents','kgb_signed_documents','employee_documents','notifications']) db.exec(source.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\);`))[0]);
db.exec('ALTER TABLE kgb_documents ADD COLUMN input_json TEXT; ALTER TABLE kgb_documents ADD COLUMN revision INTEGER NOT NULL DEFAULT 1; ALTER TABLE employee_documents ADD COLUMN nama_dokumen TEXT;');
let permission = 'pegawai';
const adapter = { prepare(sql) { const s = db.prepare(sql); return { get: async (...v) => s.get(...v), all: async (...v) => s.all(...v), run: async (...v) => s.run(...v) }; }, transaction: async statements => db.transaction(() => { for (const s of statements) db.prepare(s.sql).run(...s.values); })() };
function load(file) {
  const filename = path.resolve(file); if (cache.has(filename)) return cache.get(filename).exports;
  const m = new Module(filename); cache.set(filename,m);
  m.require = name => {
    if (name === 'server-only') return {};
    if (name === '@/lib/database') return {database:adapter};
    if (name === '@/lib/storage') return {downloadStorageObject: async n => { assert(objects.has(n)); return objects.get(n); }};
    if (name === '@/lib/session') return {getCurrentUser:async () => permission === 'anonymous' ? null : {id:'editor'}};
    if (name === '@/lib/authorization') return {checkApiAccess:async menus => menus.includes(permission) ? null : Response.json({}, {status:permission === 'anonymous' ? 401 : 403})};
    if (name.endsWith('.json')) return require(path.resolve(name.replace(/^@\//,'src/')));
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  m._compile(ts.transpileModule(readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
  return m.exports;
}
const docs = load('src/lib/employee-documents.ts'), reminders = load('src/lib/kgb-reminders.ts'), dates = load('src/lib/kgb-reminder-dates.ts');
const download = load('src/app/api/employees/[nip]/documents/[id]/download/route.ts'), archive = load('src/app/api/employees/[nip]/documents/archive/route.ts');
const nip = '199001012020121001', otherNip = '199001012020121002', documentId = randomUUID();
db.prepare('INSERT INTO employees VALUES(?,?,?,?)').run(nip,'PEGAWAI UJI','PNS','Aktif');
db.prepare('INSERT INTO employees VALUES(?,?,?,?)').run(otherNip,'PEGAWAI LAIN','PNS','Aktif');
db.prepare(`INSERT INTO kgb_documents(id,user_id,employee_nip,employee_name,nomor_surat,tgl_surat,file_name,storage_name,file_size,created_at,input_json) VALUES(?,'editor',?,'PEGAWAI UJI','SK/1','2026-11-01','sk.docx',?,100,'2026-11-01',?)`).run(documentId,nip,documentId+'.docx',JSON.stringify({tmtKgbBaru:'2026-11-01'}));
const pdfDoc = await PDFDocument.create(); pdfDoc.addPage(); const pdf = Buffer.from(await pdfDoc.save());
function signed(tmt, created = '2026-11-01', revision = 1) {
  const id = randomUUID();
  db.prepare(`INSERT INTO kgb_signed_documents(id,document_id,document_revision,employee_nip,nomor_surat,tgl_surat,tmt_kgb,user_id,original_file_name,file_name,storage_name,file_size,page_count,created_at) VALUES(?,?,?,?,?,'2026-11-01',?,'editor','signed.pdf','SK-KGB.pdf',?,?,1,?)`).run(id,documentId,revision,nip,'SK/1',tmt,id+'.pdf',pdf.length,created);
  objects.set(id+'.pdf',pdf); return id;
}
const id = signed('2026-11-01'), virtual = 'kgb-'+id, ctx = (n = nip,i = virtual) => ({params:Promise.resolve({nip:n,id:i})}), request = new Request('http://local');
try {
  assert.equal(dates.nextKgbDate('2024-02-29'),'2026-02-28'); assert.equal(dates.nextKgbDate('2026-02-30'),'');
  const linked = await docs.getEmployeeDocuments(nip); assert.equal(linked.length,1); assert.equal(linked[0].id,virtual); assert.equal(linked[0].documentType,'sk_kgb'); assert.equal(linked[0].tmtSurat,'2026-11-01'); assert(linked[0].kgbSource.currentWordVersion);
  assert.deepEqual(await docs.getEmployeeDocuments(otherNip),[]);
  let response = await download.GET(request,ctx()); assert.equal(response.status,200); assert.equal(response.headers.get('Cache-Control'),'private, no-store'); assert.deepEqual(Buffer.from(await response.arrayBuffer()),pdf);
  for (const bad of [ctx(otherNip),ctx(nip,'kgb-../../file')]) assert.equal((await download.GET(request,bad)).status,404);
  assert.equal(await docs.deleteEmployeeDocument(nip,virtual),null); assert.equal(db.prepare('SELECT count(*) n FROM kgb_signed_documents').get().n,1);
  signed('2024-11-01','2026-11-02'); // A later upload of an older SK cannot replace the latest effective TMT.
  response = await archive.GET(request,ctx()); assert.equal(response.status,200); const zip = new PizZip(Buffer.from(await response.arrayBuffer()));
  assert.equal(Object.keys(zip.files).length,2); for (const f of Object.values(zip.files)) assert.deepEqual(f.asNodeBuffer(),pdf);
  for (const role of ['kgb','anonymous']) { permission = role; const status = role === 'anonymous' ? 401 : 403; assert.equal((await download.GET(request,ctx())).status,status); assert.equal((await archive.GET(request,ctx())).status,status); } permission = 'pegawai';
  db.prepare('UPDATE kgb_documents SET revision=2,input_json=? WHERE id=?').run(JSON.stringify({tmtKgbBaru:'2030-11-01'}),documentId);
  assert.equal((await docs.getEmployeeDocuments(nip)).find(d => d.id === virtual).kgbSource.currentWordVersion,false);
  assert.equal((await reminders.getKgbReminders('2028-01-01'))[0].nextTmt,'2028-11-01','Draft edits must not move signed reminders');
  const dayOffset = n => new Date(Date.parse('2028-11-01T00:00:00Z')-n*86400000).toISOString().slice(0,10);
  db.prepare("INSERT INTO notifications VALUES('unrelated','editor','info','Other','Keep',NULL,'2026-01-01')").run();
  await reminders.syncKgbReminderNotifications('editor',true,dayOffset(91)); assert.equal(db.prepare("SELECT count(*) n FROM notifications WHERE id LIKE 'kgb-reminder:%'").get().n,0);
  await reminders.syncKgbReminderNotifications('editor',true,dayOffset(90)); let notice = db.prepare("SELECT * FROM notifications WHERE id LIKE 'kgb-reminder:%'").get(); assert(notice.id.endsWith(':upcoming'));
  db.prepare('UPDATE notifications SET read_at=? WHERE id=?').run('2028-08-04',notice.id);
  await reminders.syncKgbReminderNotifications('editor',true,dayOffset(89)); const refreshed = db.prepare('SELECT * FROM notifications WHERE id=?').get(notice.id); assert.equal(refreshed.read_at,'2028-08-04'); assert.equal(refreshed.created_at,notice.created_at); assert(refreshed.description.includes('89 hari lagi'));
  await reminders.syncKgbReminderNotifications('other',true,dayOffset(90));
  await reminders.syncKgbReminderNotifications('editor',true,dayOffset(0)); notice = db.prepare("SELECT * FROM notifications WHERE user_id='editor' AND id LIKE 'kgb-reminder:%'").get(); assert(notice.id.endsWith(':due')); assert.equal(notice.read_at,null);
  await reminders.syncKgbReminderNotifications('editor',true,dayOffset(-1)); assert(db.prepare("SELECT id FROM notifications WHERE user_id='editor' AND id LIKE 'kgb-reminder:%'").get().id.endsWith(':overdue'));
  await reminders.syncKgbReminderNotifications('editor',false,dayOffset(-1)); assert.equal(db.prepare("SELECT count(*) n FROM notifications WHERE user_id='editor'").get().n,1); assert.equal(db.prepare("SELECT count(*) n FROM notifications WHERE user_id='other'").get().n,1);
  for (const sql of ["status='Pensiun'","status='Aktif',asn_type='PPPK'"]) { db.prepare('UPDATE employees SET '+sql+' WHERE nip=?').run(nip); assert.deepEqual(await reminders.getKgbReminders(),[]); } db.prepare("UPDATE employees SET asn_type='PNS' WHERE nip=?").run(nip);
  signed('2028-11-01','2028-11-02',2); await reminders.syncKgbReminderNotifications('other',true,'2028-11-02'); assert.equal(db.prepare("SELECT count(*) n FROM notifications WHERE user_id='other'").get().n,0,'New signed SK resolves old reminder');
  assert.equal((await reminders.getKgbReminders('2028-11-02'))[0].nextTmt,'2030-11-01');
  console.log('PASS KGB links: original PDF bytes, employee/NIP and permission scope, ZIP duplicate names, read-only links, signed-only latest TMT, leap dates, 90-day boundary, notification dedup/read-state/escalation/resolution, active-PNS filtering.');
} finally { db.close(); }
