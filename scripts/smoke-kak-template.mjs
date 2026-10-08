import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import PizZip from "pizzip";
const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); cache.set(filename, mod); mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (specifier) => specifier === "server-only" ? {} : specifier.startsWith("@/") ? load(`src/${specifier.slice(2)}.ts`) : require(specifier);
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const { KAK_SECTIONS, kakDraftSchema } = load("src/lib/kak-types.ts");
const { kakOptionsSchema } = load("src/lib/kak-validation.ts");
const { generateKakDocument } = load("src/lib/kak-document.ts");
const { generateKakDraft } = load("src/lib/gemini-kak.ts");
const { getKakReferenceContext, formatKakLegalBasis } = load("src/lib/kak-references.ts");
const { resolveKakSequence } = load("src/lib/kak-sequence.ts");
const metadata = { tahunAnggaran: 2028, perangkatDaerah: "DINAS UJI & PERENCANAAN", urusanPemerintahan: "Urusan Uji", bidangUrusan: "Bidang Uji", program: "Program Uji", kegiatan: "Kegiatan Uji", subKegiatan: "Cetakan & Penggandaan", kodeSubKegiatan: "01.2.06.0005", sumberDana: "DAU", lokasi: "Indramayu", waktuPelaksanaan: "Januari s.d Desember", kelompokSasaran: "Perangkat Daerah", keluaran: "Paket", targetKeluaran: "1 Paket", paguAnggaran: "29359021.00", penandatanganNama: "", penandatanganNip: "", penandatanganJabatan: "", rincianAnggaran: [] };
const draft = kakDraftSchema.parse({ metadata, sections: Object.fromEntries(KAK_SECTIONS.map(([key]) => [key, `ISIAN ${key} & pemeriksaan.\nParagraf kedua.`])), risks: Array.from({ length: 3 }, (_, i) => ({ risiko: `RISIKO ${i}`, penyebab: `SEBAB ${i}`, mitigasi: `MITIGASI ${i}` })), warnings: [] });
assert.equal(kakDraftSchema.safeParse({ ...draft, metadata: { ...metadata, paguAnggaran: "Rp 29.359.021" } }).success, false);
assert.equal(kakDraftSchema.safeParse({ ...draft, sections: { ...draft.sections, penutup: "<generate ai>" } }).success, false);
assert.equal(kakOptionsSchema.safeParse({ tanggalDokumen: "2026-02-30" }).success, false);
for (const sequence of ["<5>", "5\n6", "1".repeat(33)]) assert.equal(kakOptionsSchema.safeParse({ tanggalDokumen: "2026-10-08", nomorUrutSubKegiatan: sequence }).success, false);
assert.equal(kakOptionsSchema.safeParse({ tanggalDokumen: "2026-10-08", pptkNip: "197801011997031003" }).success, false);
const options = kakOptionsSchema.parse({ tanggalDokumen: "2026-10-08", nomorUrutSubKegiatan: " 05 & A ", pptkNama: "PPTK UJI", pptkNip: "198001012005011001", signatory: { name: "PEJABAT UJI", nip: "197801011997031003", rank: "Pembina", title: "KEPALA DINAS", status: "plt" } });
const output = new PizZip(await generateKakDocument(draft, options));
const source = new PizZip(readFileSync("src/templates/template-kak.docx"));
const xml = output.file("word/document.xml").asText();
for (const name of Object.keys(source.files)) if (!source.files[name].dir && !["word/document.xml", "word/header-kak-cover.xml"].includes(name)) assert(source.files[name].asNodeBuffer().equals(output.file(name).asNodeBuffer()), `Changed ZIP part: ${name}`);
for (const [key] of KAK_SECTIONS) assert(xml.includes(`ISIAN ${key} &amp; pemeriksaan.`), key);
for (const text of ["2028", "DINAS UJI &amp; PERENCANAAN", "PA / KPA", "PEJABAT UJI", "PPTK UJI", "8 Oktober 2026", "RISIKO 2"]) assert(xml.includes(text), text);
assert([...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join("").includes("Penanggung Jawab / PPTK"));
assert(!xml.includes("&lt;generate")); assert(!xml.includes("&lt;nama_sub_kegiatan&gt;")); assert(!xml.includes("(Nama Jelas)"));
const sections = (x) => [...x.matchAll(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g)].map(m => m[0]);
const sourceSections = sections(source.file("word/document.xml").asText());
assert.deepEqual(sections(xml), sourceSections.map((section, index) => {
  const resized = section.replace(/<w:pgSz\b[^>]*\/>/, '<w:pgSz w:w="11906" w:h="18709"/>');
  return index === 1 ? resized.replace(/<w:type\b[^>]*\/>/, '<w:type w:val="nextPage"/>') : resized;
}));
for (const section of sections(xml)) assert(section.includes('<w:pgSz w:w="11906" w:h="18709"/>'), "Every section must use F4");
assert(sections(xml)[1].includes('<w:type w:val="nextPage"/>'), "Body must start on the page after the cover");
assert(xml.includes('<wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH>'), "Center cover logo on F4");
const grids = (x) => [...x.matchAll(/<w:tblGrid\b[^>]*>[\s\S]*?<\/w:tblGrid>/g)].map(m => m[0]);
assert.deepEqual(grids(xml), grids(source.file("word/document.xml").asText()));
const cover = xml.match(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/)[0];
for (const value of ["Program Uji", "Kegiatan Uji", "Cetakan &amp; Penggandaan", "29.359.021,00", "Indramayu"]) assert(cover.includes(value), `Cover field ${value}`);
assert(xml.includes("KERANGKA ACUAN KERJA") && !xml.includes("PETUNJUK OPERASIONAL") && xml.includes("TAHUN ANGGARAN 2028"));
const documentText = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join("");
assert(documentText.indexOf("KERANGKA ACUAN KERJA") < documentText.indexOf("Kerangka Acuan Kerja"));
assert.equal(grids(xml).length, 7); assert.equal(sections(xml).length, 5);
assert(output.file("word/header-kak-cover.xml").asText().includes("05 &amp; A"));
assert(!output.file("word/header-kak-cover.xml").asText().includes("${kak."));
assert(xml.includes('r:embed="rIdKakCoverLogo"') && xml.includes('r:id="rIdKakBodyHeader"'));
const listed = new PizZip(await generateKakDocument({ ...draft, metadata: { ...metadata, program: ".01 PROGRAM UJI", kegiatan: ".01.2.06 KEGIATAN UJI" }, sections: { ...draft.sections, dasarHukum: "1. DASAR HUKUM PERTAMA.\n2. DASAR HUKUM KEDUA.\nAcuan perencanaan: RENJA.", tahapanPelaksanaan: "Tahapan: 1. PERSIAPAN. 2. PELAKSANAAN.", totalBiaya: "Total biaya.\n1. BELANJA PERTAMA.\n2. BELANJA KEDUA." } }, options)).file("word/document.xml").asText();
for (const numId of [8, 10, 12]) assert.equal((listed.match(new RegExp(`<w:numId w:val="${numId}"/>`, "g")) || []).length, 2, `Native list ${numId}`);
assert(!listed.includes(">1. DASAR HUKUM") && !listed.includes(">1. PERSIAPAN") && !listed.includes(">1. BELANJA"), "Literal numbering duplicated");
assert(!listed.includes(".01 PROGRAM UJI") && !listed.includes(".01.2.06 KEGIATAN UJI"));
assert(!listed.includes("RORY FIRMANSYAH") && !listed.includes("MUHAMMAD IQBAL"), "Source sample identities leaked");
const missing = new PizZip(await generateKakDocument(draft, { tanggalDokumen: "2026-10-08", pptkNama: "", pptkNip: "" })).file("word/document.xml").asText();
assert(missing.includes("[Nama PA/KPA]")); assert(missing.includes("[Nama PPTK]"));
const noSequence = new PizZip(await generateKakDocument(draft, { tanggalDokumen: "2026-10-08", pptkNama: "", pptkNip: "" })).file("word/header-kak-cover.xml").asText();
assert(!noSequence.includes("${kak.") && !noSequence.includes("Nomor urut"));
for (const file of [new File(["%PDF-"], "rka.txt"), new File(["not a pdf"], "rka.pdf"), new File([], "rka.pdf"), new File([Buffer.alloc(2097153)], "rka.pdf")]) await assert.rejects(generateKakDraft(file));
console.log("PASS KAK: F4 on all sections, separate cover/body, cover/sequence, 19 slots, 3 risks, XML escaping, editable signatures, missing-data markers, ZIP preservation, input validation and 2 MB limit");
const dkpp = { ...metadata, tahunAnggaran: 2027, perangkatDaerah: "DINAS KETAHANAN PANGAN DAN PERTANIAN", subKegiatan: "Penyediaan Barang Cetakan dan Penggandaan", kodeSubKegiatan: ".01.2.06.0005" };
const sequences = JSON.parse(readFileSync("src/data/kak-sub-kegiatan-2027.json", "utf8"));
assert.equal(sequences.entries.length, 69);
assert.equal(sequences.year, 2027);
assert.equal(new Set(sequences.entries.map(entry => entry.code)).size, 69);
assert.deepEqual(sequences.entries.map(entry => entry.number), Array.from({ length: 69 }, (_, i) => i + 1));
for (const entry of sequences.entries) {
  for (const code of [entry.code, `.${entry.code.split(".").slice(2).join(".")}`, ""]) {
    const resolved = await resolveKakSequence({ ...dkpp, subKegiatan: entry.name, kodeSubKegiatan: code });
    assert.equal(resolved.number, String(entry.number), `Sequence for ${entry.code}, RKA code ${code}`);
    assert.equal(resolved.reference.sha256, sequences.sha256);
    assert(resolved.reference.locators[0].includes(`A${entry.row}:C${entry.row}`));
    assert.equal(resolved.warning, undefined);
  }
}
assert.equal((await resolveKakSequence(dkpp)).number, "26");
assert.equal((await resolveKakSequence({ ...dkpp, kodeSubKegiatan: " 2.09.01.2.06.0005 ", subKegiatan: "PENYEDIAAN  BARANG CETAKAN DAN PENGGANDAAN" })).number, "26");
assert.equal((await resolveKakSequence({ ...dkpp, kodeSubKegiatan: "", subKegiatan: "2.09.01.2.06.0005 Penyediaan Barang Cetakan dan Penggandaan" })).number, "26");
for (const changed of [
  { tahunAnggaran: 2028 }, { perangkatDaerah: "DINAS KESEHATAN" },
  { kodeSubKegiatan: "3.27.01.2.06.0005" }, { kodeSubKegiatan: "0005" },
  { kodeSubKegiatan: "", subKegiatan: "Penyediaan Barang Cetakan" },
  { kodeSubKegiatan: ".03.2.01.0014", subKegiatan: "Nama belum terbaca" },
  { kodeSubKegiatan: "2.09.01.2.06.0004" },
]) {
  const unresolved = await resolveKakSequence({ ...dkpp, ...changed });
  assert.equal(unresolved.number, ""); assert(unresolved.warning.includes("belum diisi"));
  assert.equal(unresolved.reference, undefined);
}
const manualSequence = await resolveKakSequence(dkpp, " 77 ");
assert.equal(manualSequence.number, "77"); assert.equal(manualSequence.reference, undefined);
assert.equal((await resolveKakSequence(dkpp, " ")).number, "26");
const automaticDoc = new PizZip(await generateKakDocument({ ...draft, metadata: dkpp }, { tanggalDokumen: "2026-10-08", pptkNama: "", pptkNip: "" }));
const automaticHeader = automaticDoc.file("word/header-kak-cover.xml").asText();
assert.equal([...automaticHeader.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(match => match[1]).join(""), "26");
assert(automaticHeader.includes('<w:jc w:val="right"/>'), "Sequence must stay at the upper right of the cover");
console.log("PASS supplied sequence list: all 69 activities, full/short codes, exact names, cover number 26, year/organization/conflict guards and manual override");
const context = await getKakReferenceContext(dkpp);
assert.equal(context.references.length, 2);
assert(context.text.includes("29.359.021") && context.text.includes("120.000.000"));
assert(context.text.includes("Meningkatnya Akuntabilitas Kinerja Perangkat Daerah"));
assert(context.warnings.some(w => w.includes("Renstra") && w.includes("120.000.000")));
assert(context.warnings.some(w => w.includes("target 2")));
assert(!context.laws.some(law => law.id === "renja-p72"));
assert(!context.laws.some(law => law.id === "renstra-law8"));
assert(!context.references[0].locators.includes("Tabel sumber 8, baris 38"), "Unrelated activities must not match program code 01");
const basis = formatKakLegalBasis(["renja-p62", "renstra-law33"], context);
assert(basis.includes("25 Tahun 2004") && basis.includes("160 Tahun 2024") && basis.includes("Acuan perencanaan"));
assert.equal((formatKakLegalBasis(["renja-p62", "renstra-law1"], context).match(/25 Tahun 2004/g) || []).length, 1);
assert.throws(() => formatKakLegalBasis(["fake-law"], context));
const later = await getKakReferenceContext({ ...dkpp, tahunAnggaran: 2028 });
assert.equal(later.references.length, 1); assert(later.references[0].id.startsWith("renstra")); assert(!later.text.includes("Target Renja 2027"));
assert.equal((await getKakReferenceContext({ ...dkpp, tahunAnggaran: 2030 })).references.length, 0);
assert.equal((await getKakReferenceContext(metadata)).references.length, 0);
console.log("PASS planning references: exact activity matching, year/organization scope, budget/target conflict warnings, source provenance and legal allowlist");
