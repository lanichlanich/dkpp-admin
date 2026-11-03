import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import ts from 'typescript';
const require = createRequire(import.meta.url), db = new Database(':memory:');
db.pragma('foreign_keys=ON');
db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES('spj-test');
CREATE TABLE employees(nip TEXT PRIMARY KEY,name TEXT,position TEXT,status TEXT);
CREATE TABLE plt_assignments(employee_nip TEXT,acting_position TEXT,start_date TEXT,end_date TEXT,closed_at TEXT);`);
for (const [nip, name, position] of [['197801011997031003','RORY FIRMANSYAH, S.STP, M.Si.','KEPALA DINAS KETAHANAN PANGAN DAN PERTANIAN'],['197512182002121007','MUHAMMAD IQBAL, M.T., ST','SEKRETARIS DINAS KETAHANAN PANGAN DAN PERTANIAN'],['197401092009011003','UFI NAJARUDIN LUTFI','PENGOLAH DATA DAN INFORMASI']]) db.prepare("INSERT INTO employees VALUES(?,?,?,'Aktif')").run(nip,name,position);
db.prepare('INSERT INTO plt_assignments VALUES(?,?,?,?,NULL)').run('197801011997031003','KEPALA DINAS KETAHANAN PANGAN DAN PERTANIAN','2026-10-01','2026-12-31');
let signedIn = true, allowed = true, race = false;
const adapter = { prepare(sql) { const s = db.prepare(sql); return { get: async (...v) => s.get(...v), all: async (...v) => s.all(...v), run: async (...v) => { if (race && sql.startsWith('INSERT INTO spj_service_reports')) { race = false; db.prepare("UPDATE spj_service_workers SET updated_at='concurrent' WHERE id='penyemprot-daryono'").run(); } return s.run(...v); } }; } };
const cache = new Map();
function load(file) {
  const filename = path.resolve(file); if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); cache.set(filename, mod);
  mod.require = name => {
    if (name === 'server-only') return {};
    if (name === 'next/cache') return { revalidatePath() {} };
    if (name === '@/lib/database') return { database: adapter };
    if (name === '@/lib/plt-dates') return { ...load('src/lib/plt-dates.ts'), jakartaToday: () => '2026-11-03' };
    if (name === '@/lib/authorization') return { requireMenuAccess: async menu => { assert.equal(menu,'spj-pelayanan-umum'); if (!signedIn || !allowed) throw Error('Denied'); return { id:'spj-test' }; }, checkApiAccess: async () => !signedIn ? Response.json({}, {status:401}) : !allowed ? Response.json({}, {status:403}) : null };
    if (name.startsWith('@/')) return name.endsWith('.json') ? require(path.resolve('src', name.slice(2))) : load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
  return mod.exports;
}
const schema = load('src/lib/spj-schema.ts'); db.exec(schema.SPJ_SCHEMA + schema.SPJ_SEED);
// Synthetic bank accounts test leading zero preservation without publishing private template data.
db.prepare("UPDATE spj_service_workers SET account_number=? WHERE id=?").run('0001234567890','penyemprot-daryono');
db.prepare("UPDATE spj_service_workers SET account_number=? WHERE id=?").run('0009876543210','penyemprot-syafier');
const svc = load('src/lib/spj-service.ts'), cal = load('src/lib/spj-calendar.ts');
const root = load('src/app/api/spj-pelayanan-umum/route.ts'), create = load('src/app/api/spj-pelayanan-umum/[resource]/route.ts'), edit = load('src/app/api/spj-pelayanan-umum/[resource]/[id]/route.ts'), download = load('src/app/api/spj-pelayanan-umum/reports/[id]/download/route.ts');
const post = (resource, data) => create.POST(new Request(`http://local/${resource}`,{method:'POST',body:JSON.stringify(data)}),{params:Promise.resolve({resource})});
const change = (method, resource, id, data) => edit[method](new Request('http://local',{method,body:JSON.stringify(data)}),{params:Promise.resolve({resource,id})});
const json = async (response, status=200) => { assert.equal(response.status,status,await response.clone().text()); return response.json(); };
const options = () => svc.getSpjOptions();
const makeInput = async (overrides={}) => { const o=await options(), t=o.types.find(t=>t.id==='penyemprot'); return {requestId:randomUUID(),typeId:t.id,typeUpdatedAt:t.updatedAt,period:'2026-09',seed:randomUUID(),documentDate:'2026-09-30',workers:o.workers.filter(w=>w.typeId===t.id&&w.isActive).map(w=>({id:w.id,updatedAt:w.updatedAt})),...o.defaults,...overrides}; };
try {
  const rule={dayMode:'quota',activeDays:10,weekdays:[1,2,3,4,5]}, seed='1d79c4a1-ad79-40ab-b590-3356ab7e2b5c';
  assert.equal(cal.spjMonthDays('2026-02'),28); assert.equal(cal.spjMonthDays('2028-02'),29); assert.equal(cal.spjMonthDays('2026-09'),30); assert.equal(cal.spjMonthDays('2026-01'),31);
  assert.throws(()=>cal.spjMonthDays('2026-13'));
  for (const year of ['2026','2027']) for (let month=1;month<=12;month++) {
    const period=`${year}-${String(month).padStart(2,'0')}`,days=cal.spjCalendar(period,rule,seed);
    assert.equal(days.filter(d=>d.state==='active').length,10);
    for(const day of days) { const weekend=[0,6].includes(new Date(day.date+'T00:00:00Z').getUTCDay()); if(weekend||cal.SPJ_HOLIDAYS[year][day.date.slice(5)]) assert.equal(day.state,'holiday'); if(day.state==='active')assert([1,2,3,4,5].includes(day.weekday)&&!day.holiday); }
  }
  assert.deepEqual(cal.spjCalendar('2026-09',rule,seed),cal.spjCalendar('2026-09',rule,seed));
  assert.notDeepEqual(cal.spjCalendar('2026-09',rule,seed),cal.spjCalendar('2026-09',rule,randomUUID()));
  assert.deepEqual(cal.spjCalendar('2026-09',{dayMode:'all',activeDays:10,weekdays:[1]},seed).filter(d=>d.state==='active').map(d=>d.day),[7,14,21,28]);
  assert.equal(cal.spjCalendar('2026-01',rule,seed).find(d=>d.day===16).state,'holiday');
  assert.equal(cal.spjCalendar('2027-03',rule,seed).find(d=>d.day===10).state,'holiday');
  assert.throws(()=>cal.spjCalendar('2028-02',rule,seed),/belum tersedia/);
  assert.throws(()=>cal.spjCalendar('2026-09',{...rule,weekdays:[1]},seed),/Tersedia 4/);
  let o=await options(); assert.equal(o.defaults.paNip,'197801011997031003'); assert.equal(o.defaults.paStatus,'plt'); assert.equal(o.defaults.pptkNip,'197512182002121007'); assert.equal(o.defaults.treasurerNip,'197401092009011003');
  assert.equal(o.workers[0].accountNumber,'0001234567890');
  const input=await makeInput(), id=(await json(await post('reports',{...input,paName:'FORGED'}),201)).result.id;
  const snapshot=await svc.getSpjReport(id); assert.equal(snapshot.total,2500000); assert.equal(snapshot.activeCount,10); assert.equal(snapshot.signers.pa.name,'RORY FIRMANSYAH, S.STP, M.Si.');
  assert.equal((await json(await post('reports',input),201)).result.id,id); assert.equal(db.prepare('SELECT count(*) n FROM spj_service_reports').get().n,1);
  const oldWorker=o.workers[0]; await json(await change('PATCH','workers',oldWorker.id,{...oldWorker,name:'DARYONO DIUBAH'}));
  await json(await change('PATCH','workers',oldWorker.id,{...oldWorker,name:'STALE'}),409);
  await json(await post('reports',{...input,requestId:randomUUID()}),409);
  assert.deepEqual(await svc.getSpjReport(id),snapshot);
  const raceInput=await makeInput(); race=true; await json(await post('reports',raceInput),409); assert.equal(db.prepare('SELECT count(*) n FROM spj_service_reports').get().n,1);
  await json(await post('reports',await makeInput({paNip:'190001012000011999'})),400);
  await json(await post('reports',await makeInput({period:'2028-02'})),400);
  await json(await post('reports',await makeInput({workers:[]})),400);
  await json(await post('types',{name:'Aturan salah',dayMode:'quota',activeDays:10,dailyRate:1,weekdays:[1,1]}),400);
  const typeInput={name:'Tenaga Kebersihan',dayMode:'all',activeDays:10,dailyRate:100000,weekdays:[1,2,3,4,5]};
  const newType=(await json(await post('types',typeInput),201)).result.id;
  const newWorker=(await json(await post('workers',{typeId:newType,name:'Petugas Uji',bank:'BJB',accountNumber:'000123',isActive:true}),201)).result.id;
  o=await options(); const t=o.types.find(t=>t.id===newType), w=o.workers.find(w=>w.id===newWorker);
  await json(await change('DELETE','types',newType,{confirmed:true,updatedAt:t.updatedAt}),409);
  await json(await change('DELETE','workers',newWorker,{updatedAt:w.updatedAt}),400);
  await json(await change('DELETE','workers',newWorker,{confirmed:true,updatedAt:w.updatedAt}));
  await json(await change('DELETE','types',newType,{confirmed:true,updatedAt:t.updatedAt}));
  const pdf=load('src/lib/spj-pdf.ts'); fs.mkdirSync('.tmp/spj',{recursive:true});
  for(const kind of ['attendance','receipt']) {
    const response=await download.GET(new Request(`http://local/download?kind=${kind}`),{params:Promise.resolve({id})}); assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'private, no-store'); assert(response.headers.get('content-disposition').includes('2026-09.pdf')); const bytes=Buffer.from(await response.arrayBuffer()); assert.equal(bytes.subarray(0,5).toString(),'%PDF-'); fs.writeFileSync(`.tmp/spj/${kind}.pdf`,bytes);
    const multi={...snapshot,workers:Array.from({length:9},(_,i)=>({...snapshot.workers[i%2],id:String(i),name:`PETUGAS ${i+1} NAMA PANJANG UNTUK PEMERIKSAAN TATA LETAK`})),total:11250000}; fs.writeFileSync(`.tmp/spj/${kind}-multipage.pdf`,await pdf.createSpjPdf(multi,kind));
  }
  const feb={...snapshot,period:'2027-02',documentDate:'2027-02-28',days:cal.spjCalendar('2027-02',rule,seed)}; fs.writeFileSync('.tmp/spj/attendance-february.pdf',await pdf.createSpjPdf(feb,'attendance'));
  const jan={...snapshot,period:'2026-01',documentDate:'2026-01-31',days:cal.spjCalendar('2026-01',rule,seed)}; fs.writeFileSync('.tmp/spj/attendance-january.pdf',await pdf.createSpjPdf(jan,'attendance'));
  await json(await download.GET(new Request('http://local/download?kind=wrong'),{params:Promise.resolve({id})}),400);
  await json(await download.GET(new Request('http://local/download'),{params:Promise.resolve({id:'absent'})}),404);
  for(const status of [401,403]) { signedIn=status!==401; allowed=false; assert.equal((await root.GET()).status,status); assert.equal((await post('reports',{})).status,status); assert.equal((await change('DELETE','workers','id',{})).status,status); assert.equal((await download.GET(new Request('http://local/download'),{params:Promise.resolve({id})})).status,status); }
  signedIn=true; allowed=true;
  await json(await change('DELETE','workers','penyemprot-daryono',{confirmed:true,updatedAt:'concurrent'}));
  o=await options();const last=o.workers.find(w=>w.typeId==='penyemprot'); await json(await change('DELETE','workers',last.id,{confirmed:true,updatedAt:last.updatedAt}));
  const originalType=o.types.find(t=>t.id==='penyemprot'); await json(await change('DELETE','types','penyemprot',{confirmed:true,updatedAt:originalType.updatedAt}));
  assert.deepEqual(await svc.getSpjReport(id),snapshot); assert.equal(db.prepare('SELECT type_id FROM spj_service_reports WHERE id=?').get(id).type_id,null);
  console.log('PASS SPJ: calendar lengths/leap year/24 months, exact quota, holidays/weekdays/random stability, employee-backed defaults, master CRUD, stale/concurrent write protection, request retry, immutable archived snapshots, both authenticated PDFs with pagination, and 401/403 API guards.');
} finally { db.close(); }
