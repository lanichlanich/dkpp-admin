import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';
import PDFKit from 'pdfkit';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerHooks } from 'node:module';
const hook = registerHooks({ resolve(specifier, context, next) {
  return next(specifier === './pdf-tools-config' ? './pdf-tools-config.ts' : specifier, context);
} });
const { processPdf } = await import('../src/lib/pdf-tools.ts');
hook.deregister();
const dir = await mkdtemp(join(tmpdir(), 'pdf-smoke-'));
const pdf = (name, ...pages) => new Promise(resolve => {
  const doc = new PDFKit({ autoFirstPage:false });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  doc.on('end', () => resolve(new File(chunks, name, {type:'application/pdf'})));
  for (const page of pages) doc.addPage().fontSize(18).text(page);
  doc.end();
});
const text = async (result, page) => {
  const path = join(dir,'verify.pdf');
  await writeFile(path,result.bytes);
  return execFileSync('/usr/bin/pdftotext',['-f',String(page),'-l',String(page),path,'-'],{encoding:'utf8'});
};
try {
  const a = await pdf('scan001.pdf','SURAT TUGAS\nNama : Rina Pratama','Lampiran pertama');
  const b = await pdf('scan002.pdf','SURAT TUGAS\nNama : Rina Pratama\nAgenda kedua');
  const c = await pdf('scan003.pdf','IJAZAH\nNama : Dewi Lestari');
  const [merged] = await processPdf('merge', [b,a]);
  assert.equal(merged.name,'Surat Tugas - Rina Pratama.pdf');
  assert.equal(merged.pages,3);
  const [reordered] = await processPdf('merge', [a,b], { order: [[0,2],[1,1],[0,1]] });
  assert.match(await text(reordered,1),/Lampiran pertama/);
  assert.match(await text(reordered,2),/Agenda kedua/);
  assert.match(await text(reordered,3),/SURAT TUGAS/);
  await assert.rejects(processPdf('merge',[a,b],{order:[[0,1],[0,1],[1,1]]}),/tepat satu kali/);
  await assert.rejects(processPdf('merge',[a,b],{order:[[0,1]]}),/tepat satu kali/);
  const multi = await pdf('multi.pdf','SURAT TUGAS\nNama : Rina Pratama','Jangan ikut','Lampiran ketiga');
  const [selected] = await processPdf('split',[multi],{ranges:'1,3'});
  assert.equal(selected.pages,2);
  assert.match(await text(selected,2),/Lampiran ketiga/);
  assert.match(await text(merged,1),/Agenda kedua/);
  assert.match(await text(merged,3),/Lampiran pertama/);
  assert.equal((await processPdf('merge',[a,c]))[0].name,'Surat Tugas dan Ijazah.pdf');
  const parts = await processPdf('split',[a],{ranges:'2; 1'});
  assert.deepEqual(parts.map(p=>p.name),['Surat Tugas - Rina Pratama - Hal 2.pdf','Surat Tugas - Rina Pratama - Hal 1.pdf']);
  assert.match(await text(parts[0],1),/Lampiran pertama/);
  assert.deepEqual((await processPdf('split',[a],{ranges:'1-2'})).map(p=>p.pages),[2]);
  await assert.rejects(processPdf('split',[a],{ranges:'1-2;2'}),/lebih dari sekali/);
  await assert.rejects(processPdf('split',[a],{ranges:'3'}),/rentang/i);
  await assert.rejects(processPdf('compress',[new File(['abc'],'rusak.pdf')]),/PDF/);
  await assert.rejects(processPdf('merge',[a]),/minimal/i);
  const signed = await PDFDocument.load(await a.arrayBuffer());
  signed.catalog.set(PDFName.of('ByteRange'),signed.context.obj([0,1,2,3]));
  await assert.rejects(processPdf('compress',[new File([await signed.save()],'tte.pdf')]),/tanda tangan/i);
  const src = await sharp({create:{width:2480,height:3508,channels:3,background:'#fafafa'}}).composite([{input:Buffer.from('<svg width="2480" height="3508"><text x="220" y="350" font-size="92" font-family="sans-serif">SURAT KETERANGAN</text><text x="220" y="540" font-size="79" font-family="sans-serif">Nama : Rina Pratama</text></svg>')}]).png().toBuffer();
  const scan = await PDFDocument.create();
  const image = await scan.embedPng(src);
  scan.addPage([595,842]).drawImage(image,{x:0,y:0,width:595,height:842});
  const original = new File([await scan.save()],'scan.pdf');
  const [alreadySmall] = await processPdf('compress',[a],{profile:'target1mb'});
  assert.deepEqual(alreadySmall.bytes, Buffer.from(await a.arrayBuffer()));
  const scanBytes = Buffer.from(await original.arrayBuffer());
  const xref = scanBytes.lastIndexOf('startxref');
  const beyond = Buffer.concat([scanBytes.subarray(0,xref), Buffer.from('\n%'), Buffer.alloc(1_000_000,65), Buffer.from('\n'), scanBytes.subarray(xref)]);
  const [target] = await processPdf('compress',[new File([beyond],'scan-besar.pdf')],{profile:'target1mb'});
  assert.ok(target.bytes.length < 1_000_000);
  assert.equal(target.pages,1);
  const uncompressible = await PDFDocument.create();
  let state = 12345678;
  for (let i = 0; i < 110; i++) {
    const pixels = Buffer.alloc(256 * 256);
    for (let k = 0; k < pixels.length; k++) {
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      pixels[k] = state & 255;
    }
    const jpeg = await sharp(pixels, {raw:{width:256,height:256,channels:1}}).greyscale().jpeg({quality:82}).toBuffer();
    const embedded = await uncompressible.embedJpg(jpeg);
    uncompressible.addPage([595,842]).drawImage(embedded,{x:0,y:0,width:595,height:842});
  }
  const tooDetailed = new File([await uncompressible.save()], 'berkas-besar.pdf');
  assert.ok(tooDetailed.size >= 1_000_000 && tooDetailed.size < 20 * 1024 * 1024);
  await assert.rejects(processPdf('compress',[tooDetailed],{profile:'target1mb'}), error => error.status === 422 && /di bawah 1 MB/.test(error.message));
  const [compressed] = await processPdf('compress',[original]);
  assert.equal(compressed.name,'Surat Keterangan - Rina Pratama.pdf');
  assert.equal(compressed.pages,1);
  assert.ok(compressed.bytes.length < original.size, `${compressed.bytes.length} should be smaller than ${original.size}`);
  console.log('PASS PDF tools: merge order, separate split and ranges, readable PDFs, OCR naming, strict 1 MB success and failure, real compression, malformed input and TTE guard');
} finally { await rm(dir,{recursive:true,force:true}); }
