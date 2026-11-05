import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import ts from 'typescript';
import {PDFDocument} from 'pdf-lib';
const require=createRequire(import.meta.url),cache=new Map();let access='allowed';
function load(file){const filename=path.resolve(file);if(cache.has(filename))return cache.get(filename).exports;const m=new Module(filename);cache.set(filename,m);m.require=name=>{
 if(name==='server-only')return{};
 if(name==='@/lib/database')throw Error('PDF export must not read or write database');
 if(name==='@/lib/authorization')return{checkApiAccess:async menus=>{assert.deepEqual(menus,['anjab-abk']);return access==='allowed'?null:Response.json({},{status:access==='anonymous'?401:403});}};
 if(name.endsWith('.json'))return require(path.resolve(name.replace(/^@\//,'src/')));
 if(name.startsWith('@/'))return load(`src/${name.slice(2)}.ts`);
 return require(name);
 };m._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return m.exports;}
const calc=load('src/lib/anjab-abk-calculation.ts'),{anjabCatalog:catalog}=load('src/lib/anjab-abk-source.ts'),pdf=load('src/lib/anjab-abk-pdf.ts'),api=load('src/app/api/anjab-abk/[year]/pdf/route.ts');
const plan=calc.defaultAnjabPlan(catalog),before=structuredClone(plan),all={kind:'all'},baseline=pdf.anjabPdfSheets(plan,catalog,all);
const layout=JSON.parse(readFileSync('src/data/anjab-abk-pdf-template.json','utf8'));
for(const [id,row,col] of [['usulan',7,4],['penempatan',7,4],['perhitungan',4,3]]){const c=layout.sheets.find(s=>s.id===id).cells.find(c=>c[0]===row&&c[1]===col);assert.equal(layout.styles[c[3]].color,'000000','Excel dark1 text must remain visible');}
assert.equal(baseline.length,26);assert.deepEqual(baseline.slice(0,3).map(s=>s.id),['perhitungan','usulan','penempatan']);
const cell=(s,r,c)=>s.cells.find(x=>x[0]===r&&x[1]===c)?.[2];
for(const f of catalog.families)for(const l of f.levels){const s=baseline.find(s=>s.id===l.id);assert(s);for(const t of l.tasks){assert.equal(cell(s,t.row,4),t.volume);assert.equal(cell(s,t.row,5),t.credit);}assert.equal(cell(s,Number(l.totalCell.slice(1)),6),l.verifiedTotal);assert.equal(cell(s,Number(l.divisorCell.slice(1)),6),`${l.verifiedNeed} Orang`);}
const changed=structuredClone(plan),f=catalog.families[2],l=f.levels.find(l=>l.grade==='Pelaksana'),t=l.tasks.find(t=>t.row===28);
changed.levels[l.id].tasks[t.id].volume=2000;changed.levels[l.id].divisor=10;changed.levels[l.id].staffing.needPns=10;changed.levels[l.id].staffing.existingPns=2;changed.levels[l.id].placements.bidang.pns=4;changed.variables.agencyType='B';
const updated=pdf.anjabPdfSheets(changed,catalog,all),r=calc.calculateAnjab(changed,catalog),s=updated.find(s=>s.id===l.id),row=l.recommendationRow;
assert.equal(cell(s,28,4),2000);assert.equal(cell(s,Number(l.totalCell.slice(1)),6),r.levels[l.id].total);assert.equal(cell(s,Number(l.divisorCell.slice(1)),5),10);assert.equal(cell(updated[0],6,3),'B');assert.equal(cell(updated[0],13,13),r.agency.scoreShortage);assert.equal(cell(updated[1],row,4),10);assert.equal(cell(updated[1],row,6),2);assert.equal(cell(updated[1],row,8),r.levels[l.id].shortage);assert.equal(cell(updated[2],row,4),4);
assert.deepEqual(plan,before);assert.equal(pdf.anjabPdfSheets(plan,catalog,{kind:'detail',familyId:f.id,levelId:l.id}).length,1);
const counts=async bytes=>(await PDFDocument.load(bytes)).getPageCount();
mkdirSync('.tmp/anjab-abk/pdf',{recursive:true});const combined=await pdf.createAnjabPdf(2026,plan,catalog,all);writeFileSync('.tmp/anjab-abk/pdf/all.pdf',combined);
const recap=await pdf.createAnjabPdf(2026,plan,catalog,{kind:'recap',sheet:'all'});writeFileSync('.tmp/anjab-abk/pdf/recap.pdf',recap);let expectedPages=await counts(recap);
for(const family of catalog.families){const bytes=await pdf.createAnjabPdf(2026,plan,catalog,{kind:'detail',familyId:family.id});expectedPages+=await counts(bytes);writeFileSync(`.tmp/anjab-abk/pdf/${family.id}.pdf`,bytes);}assert.equal(await counts(combined),expectedPages,'Combined PDF must contain every page exactly once');
const {DOMMatrix,ImageData,Path2D}=await import('@napi-rs/canvas');Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});const{getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
const task=getDocument({data:new Uint8Array(combined),useSystemFonts:true,isEvalSupported:false}),doc=await task.promise;let text='';
for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),view=page.getViewport({scale:1}),items=(await page.getTextContent()).items.filter(i=>'str'in i&&i.str.trim());assert(items.length>3,`Unexpected blank page ${n}`);for(const i of items){assert(i.transform[4]>=0&&i.transform[4]+i.width<=view.width+1,`Text outside page width ${n}: ${i.str}`);assert(i.transform[5]>5&&i.transform[5]<view.height,`Text outside page height ${n}: ${i.str}`);}text+=items.map(i=>i.str).join(' ')+' ';}await task.destroy();
const normalize=v=>v.replace(/\s+/g,'');const flat=normalize(text);
for(const family of catalog.families)for(const level of family.levels)for(const t of level.tasks){assert(flat.includes(normalize(t.description)),`Missing activity: ${level.id} row ${t.row}`);if(t.output)assert(flat.includes(normalize(t.output)),`Missing output ${level.id} row ${t.row}`);}
for(const phrase of ['USULAN REKOMENDASI KEBUTUHAN PEJABAT FUNGSIONAL','REKOMENDASI PENEMPATAN PEJABAT FUNGSIONAL','TOTAL SEMUA JABATAN: ABK 93','Usulan 94','Kekurangan 76','TOTAL PENEMPATAN: 94'])assert(text.includes(phrase),phrase);
const ctx=year=>({params:Promise.resolve({year:String(year)})});const post=(body,year=2026,headers={})=>api.POST(new Request('http://local/pdf',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)}),ctx(year));
for(const status of [401,403]){access=status===401?'anonymous':'denied';assert.equal((await post('bad')).status,status);}access='allowed';
assert.equal((await post('{')).status,400);assert.equal((await post({},1999)).status,400);assert.equal((await post({plan,selection:{kind:'bad'}})).status,400);assert.equal((await post({plan,selection:{kind:'detail',familyId:f.id,levelId:catalog.families[0].levels[0].id}})).status,400);
const invalid=structuredClone(plan);invalid.levels[l.id].divisor=0;assert.equal((await post({plan:invalid,selection:all})).status,422);assert.equal((await post('x'.repeat(512*1024+1))).status,413);assert.equal((await post('{}',2026,{'content-length':String(512*1024+1)})).status,413);
const response=await post({plan:changed,selection:{kind:'detail',familyId:f.id,levelId:l.id}},2098);assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'application/pdf');assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert(response.headers.get('Content-Disposition').includes(`Anjab-ABK-2098-${l.id}.pdf`));writeFileSync('.tmp/anjab-abk/pdf/edited.pdf',Buffer.from(await response.arrayBuffer()));
const jsonResponse=await post({plan,selection:{kind:'recap',sheet:'usulan'}},2026,{Accept:'application/json'});assert.equal(jsonResponse.status,200);assert.equal(jsonResponse.headers.get('Cache-Control'),'private, no-store');assert.equal(jsonResponse.headers.get('Vary'),'Accept');const json=await jsonResponse.json();assert.equal(json.filename,'Anjab-ABK-2026-rekap-usulan.pdf');assert.equal(await counts(Buffer.from(json.data,'base64')),1);
console.log(`PASS Anjab-ABK PDF: all 26 source layouts, 465 complete activities and 51 outputs; dynamic inputs/rounding/recap/placements; ${expectedPages} combined pages; year/auth/validation/size guards, private downloads and no database mutations.`);
