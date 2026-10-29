import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import Module, {createRequire} from 'node:module';
import path from 'node:path';
import Database from 'better-sqlite3';
import ts from 'typescript';
const require=createRequire(import.meta.url), db=new Database(':memory:');db.pragma('foreign_keys = ON');
db.exec("CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('test-user'); CREATE TABLE employees (nip TEXT PRIMARY KEY, name TEXT, unit TEXT, status TEXT); INSERT INTO employees VALUES ('199001012020121001','Pegawai Terdaftar','Unit DKPP','Aktif'); INSERT INTO employees VALUES ('199001012020121002','Pegawai Nonaktif','Unit DKPP','Nonaktif');");
let signedIn=true;let permissions=new Set(['perpustakaan-buku','perpustakaan-pengunjung','perpustakaan-peminjaman']);
const adapter={prepare(sql){const s=db.prepare(sql);return {get:async(...v)=>s.get(...v),all:async(...v)=>s.all(...v),run:async(...v)=>s.run(...v)};}};
const cache=new Map();
function load(file){
 const filename=path.resolve(file);if(cache.has(filename))return cache.get(filename).exports;
 const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));cache.set(filename,mod);
 mod.require=name=>{
  if(name==='server-only')return {};
  if(name==='next/cache')return {revalidatePath:()=>{}};
  if(name==='@/lib/database')return {database:adapter};
  if(name==='@/lib/authorization')return {
   requireMenuAccess:async menu=>{if(!signedIn||!permissions.has(menu))throw Error('Denied');return {id:'test-user'};},
   checkApiAccess:async menus=>!signedIn?Response.json({},{status:401}):!menus.some(m=>permissions.has(m))?Response.json({},{status:403}):null,
  };
  if(name.startsWith('@/'))return load(`src/${name.slice(2)}.ts`);
  return require(name);
 };
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return mod.exports;
}
db.exec(load('src/lib/library-schema.ts').LIBRARY_SCHEMA);
const service=load('src/lib/library.ts'), types=load('src/lib/library-types.ts'), {jakartaToday}=load('src/lib/plt-dates.ts');
const books=load('src/app/api/library/books/route.ts'), book=load('src/app/api/library/books/[id]/route.ts'), visitors=load('src/app/api/library/visitors/route.ts'), visitor=load('src/app/api/library/visitors/[id]/route.ts'), visits=load('src/app/api/library/visits/route.ts'), loans=load('src/app/api/library/loans/route.ts'), returns=load('src/app/api/library/loans/[id]/return/route.ts'), cards=load('src/app/api/library/visitors/[id]/card/route.ts');
const batchCards=load('src/app/api/library/visitors/cards/route.ts');
const request=(data,method='POST')=>new Request('http://localhost/api/library',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const ctx=id=>({params:Promise.resolve({id})});
const today=jakartaToday(), yesterday=new Date(new Date(`${today}T00:00:00Z`).getTime()-86400000).toISOString().slice(0,10);
const tomorrow=new Date(new Date(`${today}T00:00:00Z`).getTime()+86400000).toISOString().slice(0,10);
const baseBook={inventoryCode:'000123',title:'Buku Uji Pertanian',publicationYear:'-',publicationPlace:'Indramayu',publisher:'Penerbit Uji',isbn:'-',category:'Pertanian',copies:2,shelf:'A-1',notes:'Catatan privat',isActive:true};
const baseVisitor={employeeNip:'',name:'Pengunjung Umum',organization:'Masyarakat',phone:'08123456789',address:'Alamat pribadi',isActive:true};
async function created(api,data){const response=await api.POST(request(data));assert.equal(response.status,201,await response.clone().text());return (await response.json()).result.id;}
async function bookRow(id){return (await service.getLibraryBooks()).find(b=>b.id===id);}
try {
 const seed=JSON.parse(fs.readFileSync('src/data/library-books.json','utf8'));assert.equal(seed.length,154);assert.equal(seed.reduce((n,b)=>n+b.copies,0),251);assert.equal(new Set(seed.map(b=>b.inventoryCode)).size,154);assert.equal(seed[0].inventoryCode,'2026000112');
 const id=await created(books,baseBook);assert.equal((await bookRow(id)).inventoryCode,'000123');
 assert.equal((await books.POST(request(baseBook))).status,409);
 const visitorId=await created(visitors,baseVisitor), employeeId=await created(visitors,{...baseVisitor,employeeNip:'199001012020121001',name:'Forged',organization:'Forged'});
 const e=await service.getLibraryVisitor(employeeId);assert.equal(e.name,'Pegawai Terdaftar');assert.equal(e.organization,'Unit DKPP');
 assert.notEqual(e.cardNumber,(await service.getLibraryVisitor(visitorId)).cardNumber);
 assert.equal((await visitors.POST(request({...baseVisitor,employeeNip:'199001012020121001'}))).status,409);
 assert.equal((await visitors.POST(request({...baseVisitor,employeeNip:'199001012020121002'}))).status,400);
 assert.equal((await visitors.POST(request({...baseVisitor,employeeNip:'199001012020121099'}))).status,400);
 assert.equal((await visitors.POST(request({...baseVisitor,name:''}))).status,400);
 await created(visits,{visitorId,visitDate:today,purpose:'Membaca buku'});assert.equal((await service.getLibraryVisits()).length,1);
 assert.equal((await visits.POST(request({visitorId,visitDate:tomorrow,purpose:''}))).status,400);
 assert.equal((await visits.POST(request({visitorId,visitDate:'2026-02-30',purpose:''}))).status,400);
 const l={bookId:id,visitorId,quantity:2,loanDate:yesterday,dueDate:yesterday,notes:'Transaksi uji'};
 const loanId=await created(loans,l);assert.equal((await bookRow(id)).available,0);assert.equal((await bookRow(id)).borrowed,2);
 assert.equal((await loans.POST(request({...l,quantity:1}))).status,409,'Cannot exceed stock');
 assert.equal((await loans.POST(request({...l,loanDate:tomorrow,dueDate:tomorrow}))).status,400);
 assert.equal((await loans.POST(request({...l,dueDate:'2020-01-01'}))).status,400);
 assert.equal((await loans.POST(request({...l,quantity:0}))).status,400);
 assert.equal((await loans.POST(request({...l,quantity:1.5}))).status,400);
 let b=await bookRow(id);
 assert.equal((await book.PATCH(request({...baseBook,copies:1,updatedAt:b.updatedAt},'PATCH'),ctx(id))).status,409,'Cannot reduce below loaned copies');
 assert.equal((await book.PATCH(request({...baseBook,updatedAt:'stale'},'PATCH'),ctx(id))).status,409);
 assert.equal((await book.DELETE(request({confirmed:true,updatedAt:b.updatedAt},'DELETE'),ctx(id))).status,409,'Keep loan history');
 const rows=await service.getLibraryLoans();assert.equal(types.loanStatus(rows[0],today),'Terlambat');
 assert.equal((await returns.POST(request({returnDate:'2020-01-01'}),ctx(loanId))).status,409);
 assert.equal((await returns.POST(request({returnDate:tomorrow}),ctx(loanId))).status,400);
 assert.equal((await returns.POST(request({returnDate:today}),ctx(loanId))).status,200);
 assert.equal((await returns.POST(request({returnDate:today}),ctx(loanId))).status,409,'Double return must not change stock');
 assert.equal((await bookRow(id)).available,2);assert.equal(types.loanStatus((await service.getLibraryLoans())[0],today),'Dikembalikan');
 assert.equal((await book.PATCH(request({...baseBook,isActive:false,updatedAt:b.updatedAt},'PATCH'),ctx(id))).status,200);
 assert.equal((await service.getPublicLibraryBooks()).length,0);assert.equal((await loans.POST(request(l))).status,409);
 b=await bookRow(id);assert.equal((await book.PATCH(request({...baseBook,updatedAt:b.updatedAt},'PATCH'),ctx(id))).status,200);
 const v=await service.getLibraryVisitor(visitorId);
 assert.equal((await visitor.PATCH(request({...baseVisitor,isActive:false,updatedAt:v.updatedAt},'PATCH'),ctx(visitorId))).status,200);
 assert.equal((await loans.POST(request(l))).status,409);assert.equal((await visits.POST(request({visitorId,visitDate:today,purpose:''}))).status,409);
 assert.equal((await visitor.PATCH(request({...baseVisitor,updatedAt:'stale'},'PATCH'),ctx(visitorId))).status,409);
 assert.equal((await visitor.PATCH(request({...baseVisitor,employeeNip:'199001012020121001',updatedAt:v.updatedAt},'PATCH'),ctx(visitorId))).status,400);
 const disposable=await created(books,{...baseBook,inventoryCode:'delete-me'});const del=await bookRow(disposable);
 assert.equal((await book.DELETE(request({confirmed:false,updatedAt:del.updatedAt},'DELETE'),ctx(disposable))).status,400);
 assert.equal((await book.DELETE(request({confirmed:true,updatedAt:del.updatedAt},'DELETE'),ctx(disposable))).status,200);
 assert.equal((await books.POST(new Request('http://localhost',{method:'POST',body:'bad JSON'}))).status,400);
 assert.equal((await books.POST(new Request('http://localhost',{method:'POST',body:' '.repeat(65537)}))).status,413);
 const card=await cards.GET(new Request('http://localhost'),ctx(employeeId));assert.equal(card.status,200);assert.equal(card.headers.get('cache-control'),'private, no-store');assert.match(card.headers.get('content-disposition'),/^attachment;/);
 const bytes=Buffer.from(await card.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');fs.mkdirSync('.tmp/library',{recursive:true});fs.writeFileSync('.tmp/library/card.pdf',bytes);
 const longCard=await load('src/lib/library-card.ts').createLibraryCard({...e,name:'Nama Pengunjung Panjang '.repeat(8).trim(),organization:'Unit Organisasi dan Instansi yang Panjang '.repeat(7).trim()});fs.writeFileSync('.tmp/library/card-long.pdf',longCard);
 const batchIds=[];
 for(let i=1;i<=13;i++)batchIds.push(await created(visitors,{...baseVisitor,name:`Pengunjung Batch ${String(i).padStart(2,'0')}`}));
 const orderedIds=[...batchIds].reverse();
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 for(const count of [1,6,7,13]){
  const ids=orderedIds.slice(0,count),response=await batchCards.POST(request({visitorIds:ids,name:'FORGED NAME'}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('content-type'),'application/pdf');assert.match(response.headers.get('content-disposition'),/^inline;/);
  const bytes=Buffer.from(await response.arrayBuffer());fs.writeFileSync(`.tmp/library/cards-${count}.pdf`,bytes);
  const loadingTask=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true,verbosity:0}),pdf=await loadingTask.promise;
  assert.equal(pdf.numPages,Math.ceil(count/6));
  const people=await service.getLibraryCardVisitors({visitorIds:ids});assert.deepEqual(people.map(p=>p.id),ids);assert(!people.some(p=>'phone'in p||'address'in p||'employeeNip'in p));
  const extracted=[];
  for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
   const page=await pdf.getPage(pageNumber),viewport=page.getViewport({scale:1});assert(Math.abs(viewport.width-595.28)<0.1);assert(Math.abs(viewport.height-841.89)<0.1);
   const content=await page.getTextContent(),text=content.items.map(i=>i.str).join(' ');assert(!text.includes('FORGED NAME'));assert(!text.includes(baseVisitor.phone));assert(!text.includes(baseVisitor.address));
   const pageCards=content.items.filter(item=>people.some(p=>p.cardNumber===item.str));assert.equal(pageCards.length,Math.min(6,count-(pageNumber-1)*6));
   for(const item of pageCards){assert(item.transform[4]>30&&item.transform[4]<viewport.width-30);assert(item.transform[5]>30&&item.transform[5]<viewport.height-30);}
   extracted.push(...pageCards.map(item=>item.str));
  }
  assert.deepEqual(extracted,people.map(p=>p.cardNumber));await loadingTask.destroy();
 }
 for(const input of [{visitorIds:[]},{visitorIds:['bad-id']},{visitorIds:[visitorId,visitorId]},{visitorIds:Array.from({length:1001},()=>randomUUID())}])assert.equal((await batchCards.POST(request(input))).status,400);
 const batchPeople=await service.getLibraryCardVisitors({visitorIds:batchIds.slice(0,5)});
 fs.writeFileSync('.tmp/library/cards-long.pdf',await load('src/lib/library-card.ts').createLibraryCards([{...e,name:'Nama Pengunjung Panjang '.repeat(8).trim(),organization:'Unit Organisasi dan Instansi yang Panjang '.repeat(7).trim()},...batchPeople]));
 assert.equal((await batchCards.POST(request({visitorIds:[visitorId,randomUUID()]}))).status,409,'Missing selection must fail the entire PDF');
 assert.equal((await batchCards.POST(request({visitorIds:Array.from({length:1000},()=>randomUUID())}))).status,409,'The supported maximum must fit the database parameter limit');
 const maximumCards=Array.from({length:1000},(_,index)=>({...e,id:randomUUID(),cardNumber:`DKPP-${String(index).padStart(16,'0')}`,name:`${index} ${'Nama Pengunjung '.repeat(12)}`.slice(0,200),organization:'Unit Organisasi Pengujian '.repeat(12).slice(0,300)}));
 const maximumPdf=await load('src/lib/library-card.ts').createLibraryCards(maximumCards);assert(maximumPdf.length<4.5*1024*1024,'Maximum batch must fit a buffered Vercel response');
 assert.equal((await batchCards.POST(new Request('http://localhost',{method:'POST',body:'not json'}))).status,400);
 assert.equal((await batchCards.POST(new Request('http://localhost',{method:'POST',body:' '.repeat(65537)}))).status,413);
 const publicBooks=await service.getPublicLibraryBooks();assert.equal(publicBooks.length,1);for(const key of ['notes','updatedAt','isActive','name','phone','address','employeeNip'])assert(!Object.hasOwn(publicBooks[0],key),`Public PII: ${key}`);
 permissions=new Set(['perpustakaan-peminjaman']);assert.equal((await books.GET()).status,403);assert.equal((await visitors.GET()).status,403);assert.equal((await cards.GET(new Request('http://localhost'),ctx(employeeId))).status,403);assert.equal((await loans.GET()).status,200);assert((await service.getLibraryLoanOptions()).visitors.every(v=>!('phone' in v)));
 assert.equal((await batchCards.POST(request({visitorIds:batchIds}))).status,403);
 signedIn=false;for(const api of [books,visitors,visits,loans]){assert.equal((await api.GET()).status,401);assert.equal((await api.POST(request({}))).status,401);}assert.equal((await cards.GET(new Request('http://localhost'),ctx(employeeId))).status,401);
 assert.equal((await batchCards.POST(request({visitorIds:batchIds}))).status,401);
 assert.equal((await service.getPublicLibraryBooks()).length,1,'Public catalog must work without login');
 assert.equal(db.pragma('foreign_key_check').length,0);
 console.log('PASS library: source 154/251, permissions, public privacy, manual/employee identity, cards and selected-card A4 batches (1/6/7/13), six per page, order/privacy/bounds, visits, atomic stock bounds, dates, inactive records, version checks, returns, deletion history.');
}finally{db.close();}
