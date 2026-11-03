import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import Database from 'better-sqlite3';
import ts from 'typescript';
const require=createRequire(import.meta.url),db=new Database(':memory:');db.pragma('foreign_keys=ON');db.exec('CREATE TABLE users(id TEXT PRIMARY KEY)');
let actor=null,reads=0;const cache=new Map();
const adapter={prepare(sql){const s=db.prepare(sql);return {get:async(...v)=>{reads++;return s.get(...v);},all:async(...v)=>{reads++;return s.all(...v);}};}};
function load(file){const filename=path.resolve(file);if(cache.has(filename))return cache.get(filename).exports;const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));cache.set(filename,mod);mod.require=name=>{
 if(name==='server-only')return {};
 if(name==='@/lib/database')return {database:adapter};
 if(name==='@/lib/session')return {getCurrentUser:async()=>actor,requireUser:async()=>{if(!actor)throw Error('Redirect:/login');return actor;}};
 if(name==='@/lib/plt-dates')return {jakartaToday:()=> '2026-11-03'};
 if(name==='next/navigation')return {redirect:path=>{throw Error(`Redirect:${path}`);}};
 if(name.startsWith('@/'))return load(`src/${name.slice(2)}.ts`);return require(name);
 };mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return mod.exports;}
db.exec(load('src/lib/library-schema.ts').LIBRARY_SCHEMA);
const access=load('src/lib/access-control.ts'),{mapPublicUser}=load('src/lib/db-types.ts'),service=load('src/lib/library-statistics.ts'),api=load('src/app/api/library/statistics/route.ts'),types=load('src/lib/library-statistics-types.ts');
const user=(roleName,admin=0,menus=[])=>mapPublicUser({id:'actor',name:'Perpustakaan',username:'perpustakaan',email:'uji@example.test',created_at:'2026-11-03',role_id:roleName,is_administrator:admin,role_name:roleName,role_permissions:JSON.stringify(menus)});
const request=period=>new Request(`http://localhost/api/library/statistics${period===undefined?'':`?period=${encodeURIComponent(period)}`}`);
try {
 for(const role of ['Kepegawaian','Keuangan','unassigned','Administrator','Perpustakaan Lain']){
  actor=user(role,0,['perpustakaan-statistik','perpustakaan-buku','perpustakaan-pengunjung','perpustakaan-peminjaman']);assert.equal(access.canAccessMenu(actor,'perpustakaan-statistik'),false);assert.equal(access.canAccessPath(actor,'/dashboard/perpustakaan/statistik'),false);
  const before=reads;assert.equal((await api.GET(request('2026-10'))).status,403);await assert.rejects(()=>service.getLibraryStatistics('2026-10'),/Redirect:/);assert.equal(reads,before,'Denied roles must not query statistics');
 }
 actor=null;assert.equal((await api.GET(request())).status,401);
 for(const allowed of [user('Administrator',1),user('Perpustakaan'),user('  PERPUSTAKAAN  ')]){
  actor=allowed;assert.equal(access.canAccessMenu(actor,'perpustakaan-statistik'),true);assert.equal(access.canAccessPath(actor,'/dashboard/perpustakaan/statistik'),true);const r=await api.GET(request('2026-10'));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');const empty=await r.json();assert(Object.values(empty.snapshot).every(v=>v===0));assert(Object.values(empty.activity).every(v=>v===0));assert.equal(empty.months.length,12);assert.deepEqual(empty.categories,[]);assert.deepEqual(empty.popularBooks,[]);
 }
 actor=user('Perpustakaan');assert.equal(access.landingPath(actor),'/dashboard/perpustakaan/statistik');
 for(const period of ['2026-13','2026-00','2026-1','2026-10-01','bad','',"2026-10' OR 1=1"]){const before=reads;assert.equal((await api.GET(request(period))).status,400);assert.equal(reads,before);}
 assert.equal((await(await api.GET(request())).json()).period,'2026-11');
 assert.deepEqual(types.libraryPeriodWindow('2024-02').start,'2024-02-01');assert.equal(types.libraryPeriodWindow('2024-02').end,'2024-03-01');assert.equal(types.libraryPeriodWindow('2026-01').trendStart,'2025-02-01');assert.equal(types.libraryPeriodWindow('2026-12').end,'2027-01-01');
 const now='2026-11-03T00:00:00.000Z';
 for(const[id,title,category,copies,active]of[['a','Pertanian','Buku Pertanian',5,1],['b','Sapi',' buku pertanian ',4,1],['c','Arsip','',3,0],['d','Kosong','Novel',0,1]])db.prepare('INSERT INTO library_books(id,inventory_code,title,category,copies,is_active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(id,id,title,category,copies,active,now,now);
 for(const[id,employee,active]of[['v1',null,1],['v2','199001012020121001',1],['v3',null,0]])db.prepare('INSERT INTO library_visitors(id,card_number,name,employee_nip,is_active,phone,address,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,id,'PENGUNJUNG RAHASIA',employee,active,'KONTAK PRIVAT','ALAMAT PRIVAT',now,now);
 for(const[id,visitor,date]of[['visit1','v1','2026-09-30'],['visit2','v1','2026-10-01'],['visit3','v1','2026-10-01'],['visit4','v2','2026-10-31'],['visit5','v3','2026-11-01']])db.prepare('INSERT INTO library_visits(id,visitor_id,visit_date,created_at) VALUES(?,?,?,?)').run(id,visitor,date,now);
 for(const[id,book,qty,date,due,returned]of[['l1','a',2,'2026-10-01','2026-11-02',null],['l2','b',1,'2026-10-31','2026-11-03',null],['l3','c',1,'2026-09-30','2026-11-20',null],['l4','a',1,'2026-09-30','2026-10-07','2026-10-01'],['l5','b',2,'2026-10-10','2026-10-31','2026-10-31'],['l6','a',1,'2026-11-01','2026-11-08','2026-11-02']])db.prepare('INSERT INTO library_loans(id,book_id,visitor_id,quantity,loan_date,due_date,return_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,book,'v1',qty,date,due,returned,now,now);
 const data=await service.getLibraryStatistics('2026-10');
 assert.deepEqual(data.snapshot,{bookEntries:4,activeBooks:3,totalCopies:12,availableCopies:6,registeredVisitors:3,activeVisitors:2,employeeVisitors:1,openLoans:3,borrowedCopies:4,overdueLoans:1});
 assert.deepEqual(data.activity,{visits:3,uniqueVisitors:2,loans:3,loanCopies:5,returns:2,returnCopies:3});
 assert.deepEqual(data.categories,[{category:'buku pertanian',entries:2,copies:9},{category:'tanpa kategori',entries:1,copies:3},{category:'novel',entries:1,copies:0}]);
 assert.deepEqual(data.popularBooks.map(b=>({id:b.id,copies:b.copies,loans:b.loans})),[{id:'b',copies:3,loans:2},{id:'a',copies:2,loans:1}]);
 assert.equal(data.months[0].month,'2025-11');assert.equal(data.months.at(-1).month,'2026-10');assert.deepEqual(data.months.at(-1),{month:'2026-10',label:types.libraryMonthLabel('2026-10',true),visits:3,loans:3,returns:2});assert.equal(data.months.filter(m=>m.visits===0&&m.loans===0&&m.returns===0).length,10);
 const serialized=JSON.stringify(data);for(const value of ['PENGUNJUNG RAHASIA','KONTAK PRIVAT','ALAMAT PRIVAT','199001012020121001'])assert(!serialized.includes(value));
 db.prepare("UPDATE library_loans SET return_date='2026-11-03' WHERE id='l1'").run();const refreshed=await service.getLibraryStatistics('2026-10');assert.equal(refreshed.snapshot.availableCopies,8);assert.equal(refreshed.snapshot.borrowedCopies,2);assert.equal(refreshed.snapshot.openLoans,2);assert.equal(refreshed.snapshot.overdueLoans,0);assert.deepEqual(refreshed.activity,data.activity,'Current returns must not rewrite historical month totals');
 console.log('PASS library statistics: strict administrator/library role gate despite custom menus, private API/auth, empty data, month boundaries/leap/year, distinct visits, loan quantities vs transactions, cross-month returns, inactive stock, due-today not late, 12-month zeros, top books/categories, privacy and fresh reads.');
}finally{db.close();}
