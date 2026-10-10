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
  mod.require = (specifier) => specifier === "server-only" ? {} : specifier.startsWith("@/") ? specifier.endsWith(".json") ? require(path.resolve(`src/${specifier.slice(2)}`)) : load(`src/${specifier.slice(2)}.ts`) : require(specifier);
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const { KAK_SECTIONS, kakDraftSchema } = load("src/lib/kak-types.ts");
const { kakOptionsSchema } = load("src/lib/kak-validation.ts");
const { generateKakDocument } = load("src/lib/kak-document.ts");
const { generateKakDraft } = load("src/lib/gemini-kak.ts");
const { getKakReferenceContext, formatKakLegalBasis } = load("src/lib/kak-references.ts");
const { resolveKakSequence } = load("src/lib/kak-sequence.ts");
const { generatePoDocument, getPoWarnings } = load("src/lib/po-document.ts");
const { readKakPoFile, kakDocumentRows } = load("src/lib/kak-file-metadata.ts");
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
const listed = new PizZip(await generateKakDocument({ ...draft, metadata: { ...metadata, program: ".01 PROGRAM UJI", kegiatan: ".01.2.06 KEGIATAN UJI" }, sections: { ...draft.sections, dasarHukum: "1. DASAR HUKUM PERTAMA.\n2. DASAR HUKUM KEDUA.\nCatatan penyusunan.", tahapanPelaksanaan: "Tahapan: 1. PERSIAPAN. 2. PELAKSANAAN.", totalBiaya: "Total biaya.\n1. BELANJA PERTAMA.\n2. BELANJA KEDUA." } }, options)).file("word/document.xml").asText();
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
assert(basis.includes("25 Tahun 2004") && basis.includes("160 Tahun 2024") && !basis.includes("Acuan perencanaan") && !basis.includes("Renja DKPP") && !basis.includes("Renstra DKPP"));
assert.equal((formatKakLegalBasis(["renja-p62", "renstra-law1"], context).match(/25 Tahun 2004/g) || []).length, 1);
assert.throws(() => formatKakLegalBasis(["fake-law"], context));
const later = await getKakReferenceContext({ ...dkpp, tahunAnggaran: 2028 });
assert.equal(later.references.length, 1); assert(later.references[0].id.startsWith("renstra")); assert(!later.text.includes("Target Renja 2027"));
assert.equal((await getKakReferenceContext({ ...dkpp, tahunAnggaran: 2030 })).references.length, 0);
assert.equal((await getKakReferenceContext(metadata)).references.length, 0);
console.log("PASS planning references: exact activity matching, year/organization scope, budget/target conflict warnings, source provenance and legal allowlist");
const poDraft = kakDraftSchema.parse({ ...draft, metadata: { ...metadata, hasil: "Hasil kegiatan uji", targetHasil: "100 Persen", penandatanganPangkat: "Pembina", sistemPengadaan: "Swakelola", rincianRekening: [{ kode: "5.1.02.01.01.0026", uraian: "Belanja cetakan & penggandaan", jumlah: "29359021.00" }] } });
const poResult = await generatePoDocument(poDraft, { ...options, poSistemPengadaan: "Penyedia" });
const poOutput = new PizZip(poResult.document), poSource = new PizZip(readFileSync("src/templates/template-po.docx"));
const poXml = poOutput.file("word/document.xml").asText();
for (const name of Object.keys(poSource.files)) if (!poSource.files[name].dir && name !== "word/document.xml") assert(poSource.files[name].asNodeBuffer().equals(poOutput.file(name).asNodeBuffer()), `PO changed ZIP part: ${name}`);
for (const value of ["PETUNJUK OPERASIONAL", "2028", "29.359.021,00", "Dua Puluh Sembilan Juta Tiga Ratus Lima Puluh Sembilan Ribu Dua Puluh Satu Rupiah", "Hasil kegiatan uji (100 Persen)", "5.1.02.01.01.0026", "Penyedia", "Plt. KEPALA DINAS", "PEJABAT UJI", "8 Oktober 2026"]) assert(poXml.includes(value), `PO field ${value}`);
assert(!poXml.includes("${po.") && !poXml.includes("299.622.100") && !poXml.includes("400 Keluarga") && !poXml.includes("RORY FIRMANSYAH") && !poXml.includes(">Swakelola<"));
assert.deepEqual(sections(poXml), sections(poSource.file("word/document.xml").asText()));
const poTables = poXml.match(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g);
assert.equal((poTables[3].match(/<w:tr(?:\s[^>]*)?>/g) || []).length, 3, "Exact account rows plus header/total");
const fallbackPo = new PizZip((await generatePoDocument(draft, { tanggalDokumen: "2026-10-08", pptkNama: "", pptkNip: "" })).document).file("word/document.xml").asText();
assert(fallbackPo.includes("[Sistem pengadaan perlu ditetapkan]") && fallbackPo.includes("[Indikator hasil perlu dilengkapi]") && !fallbackPo.includes(">Swakelola<"));
assert.equal(getPoWarnings(draft, options).length, 3);
assert.equal(getPoWarnings(poDraft, options).length, 0);
const poFile = { storageName: "12345678-1234-1234-1234-123456789abc.docx", fileName: "Draft-PO-Uji-2028.docx", fileSize: poResult.document.length, templateSha256: poResult.templateSha256 };
assert.deepEqual(readKakPoFile(JSON.stringify({ poDocument: poFile })), poFile);
assert.equal(readKakPoFile("{}"), undefined); assert.equal(readKakPoFile('{"poDocument":{"storageName":"../../etc.docx"}}'), undefined);
const backupRows = kakDocumentRows({ id: "uji", storage_name: "kak.docx", source_storage_name: "rka.pdf", draft_json: JSON.stringify({ poDocument: poFile }) });
assert.equal(backupRows.length, 3); assert.equal(backupRows[2].storage_name, poFile.storageName); assert.equal(backupRows[2].file_size, poFile.fileSize);
assert.equal(kakDocumentRows({ id: "legacy", draft_json: "{}" }).length, 2);
console.log("PASS PO template: exact source layout/parts, dynamic account table, rupiah words, date/signatory, missing-data markers, procurement override and PO backup metadata");
const client = load("src/lib/gemini-client.ts");
const requests = [];
client.requestGeminiJson = async (...args) => {
  requests.push(args);
  return { model: "test", value: requests.length === 1 ? { isRka: true, reason: "", metadata } : { sections: draft.sections, risks: draft.risks, warnings: [], legalBasisIds: [] } };
};
const chosen = await generateKakDraft(new File(["%PDF-test"], "rka.pdf"), { poSistemPengadaan: "Swakelola" });
assert.equal(requests.length, 2); assert(requests[1][1][0].text.includes("Pengguna memilih Swakelola"));
assert.equal(chosen.draft.metadata.sistemPengadaan, undefined, "Manual preference must not overwrite RKA facts");
const uploaded = [], deleted = [], inserted = [];
let failUpload = false, failDatabase = false;
cache.set(path.resolve("src/lib/storage.ts"), { exports: { isStorageConfigured: () => true,
  uploadStorageObject: async (name, bytes) => { if (failUpload && uploaded.length === 1) throw new Error("storage failure"); uploaded.push({ name, bytes }); },
  deleteStorageObject: async (name) => { deleted.push(name); },
} });
cache.set(path.resolve("src/lib/database.ts"), { exports: { database: { prepare: () => ({ run: async (...args) => { if (failDatabase) throw new Error("database failure"); inserted.push(args); } }) } } });
const { saveKak } = load("src/lib/kak.ts");
const saveInput = { userId: "test", draft: poDraft, options, model: "test", document: Buffer.from("kak"), poDocument: poResult.document, poTemplateSha256: poResult.templateSha256, source: Buffer.from("%PDF-test"), sourceName: "rka.pdf" };
failUpload = true;
await assert.rejects(saveKak(saveInput), /storage failure/);
assert.deepEqual(deleted, uploaded.map((file) => file.name)); assert.equal(inserted.length, 0);
uploaded.length = deleted.length = 0; failUpload = false; failDatabase = true;
await assert.rejects(saveKak(saveInput), /database failure/);
assert.equal(uploaded.length, 3); assert.deepEqual([...deleted].sort(), uploaded.map((file) => file.name).sort());
uploaded.length = deleted.length = 0; failDatabase = false;
const saved = await saveKak(saveInput);
assert.equal(uploaded.length, 3); assert.equal(deleted.length, 0); assert.equal(inserted.length, 1);
const savedPo = readKakPoFile(inserted[0][12]);
assert.equal(savedPo.fileName, saved.poFileName); assert(uploaded[1].bytes.equals(saveInput.poDocument));
assert(saved.bundleFileName.endsWith(".zip"));
console.log("PASS shared procurement preference, single extraction/narrative workflow and rollback on partial storage/database failures");
