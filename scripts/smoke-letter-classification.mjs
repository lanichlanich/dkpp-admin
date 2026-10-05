import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import PizZip from "pizzip";
import ts from "typescript";

// Load the actual TypeScript modules without starting Next or touching stored data.
const root = process.cwd();
const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  if (filename.endsWith(".json")) return JSON.parse(readFileSync(filename, "utf8"));
  const mod = new Module(filename);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (specifier) => {
    if (specifier === "server-only") return {};
    // Only the Kerjaku schema is used; fail if persistence is accidentally invoked.
    if (["@/lib/database", "@/lib/storage"].includes(specifier)) return new Proxy({}, { get: () => { throw new Error("Persistence must not be used by this smoke test."); } });
    if (specifier.startsWith("@/")) return load(`src/${specifier.slice(2)}${path.extname(specifier) ? "" : ".ts"}`);
    return require(specifier);
  };
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  mod._compile(source, filename);
  return mod.exports;
}

const catalog = load("src/lib/letter-classification.ts");
assert.equal(catalog.letterClassifications.length, 2940);
assert.equal(new Set(catalog.letterClassifications.map((entry) => entry.code)).size, 2940);
assert.equal(catalog.classificationGroups.length, 10);
const hash = createHash("sha256").update(readFileSync(path.join(root, "public/references/kode-klasifikasi-arsip-indramayu.pdf"))).digest("hex");
assert.equal(hash, catalog.classificationSource.sha256);
assert.equal(catalog.getLetterClassification("800.1.11.1").page, 109);
assert.match(catalog.getLetterClassification("800.1.11.13").label, /Gaji Berkala/);
assert(catalog.getLetterClassification("00.1.1"), "Preserve the source's printed 00 codes");
assert.equal(catalog.searchLetterClassifications("800.1.11.13")[0].code, "800.1.11.13");
assert(catalog.searchLetterClassifications("gaji berkala").some((entry) => entry.code === "800.1.11.13"));
assert(catalog.searchLetterClassifications("", "000").every((entry) => entry.group === "000"));
assert.equal(catalog.suggestPengantarClassification("Usulan pensiun DPCP"), "800.1.6.6");
assert.equal(catalog.suggestPengantarClassification("Dokumen yang belum dikenali"), "");
Object.values(catalog.letterClassificationDefaults).forEach((code) => assert(catalog.getLetterClassification(code)));
console.log("PASS catalog, source hash, hierarchy, search and suggestions");

const schemas = [
  ["KGB", load("src/lib/kgb-validation.ts").kgbSchema.shape.nomorSurat],
  ["WFH", load("src/lib/wfh-validation.ts").wfhSchema.shape.nomorSurat],
  ["HUKDIS/HUKDA", load("src/lib/official-statement-validation.ts").officialStatementSchema.shape.nomorSurat],
  ["Surat Pengantar", load("src/lib/surat-pengantar-validation.ts").suratPengantarSchema.shape.nomorSurat],
  ["Kerjaku", load("src/lib/pembukaan-kerjaku.ts").kerjakuRequestSchema.shape.nomorSurat],
  ["PAK", load("src/lib/pak-validation.ts").pakSchema.shape.nomor],
];
for (const [name, schema] of schemas) {
  for (const invalid of ["", "123-Sekre", "999.999/123", "800.1.11.13/", "800.1.11.13/Sekre", "800.1.11.13/123\nfoo", "800.1.11.13/123{foo}", `800.1.11.13/${"1".repeat(120)}`]) {
    assert.equal(schema.safeParse(invalid).success, false, `${name} accepted ${JSON.stringify(invalid)}`);
  }
  for (const valid of ["800.1.11.13/123-Sekre", "800.1.4.5/1393/KEP/6115/SK/PAK/2026", "00.1.1/1/2026"]) assert(schema.safeParse(valid).success, name);
}
assert.equal(catalog.displayKgbLetterNumber("123"), "800.1.11.13/123-Sekre");
assert.equal(catalog.displayKgbLetterNumber("800.1.11.13/123-Sekre"), "800.1.11.13/123-Sekre");
console.log("PASS all six form validators and legacy KGB archive display");

const { generateKgbDocument } = load("src/lib/kgb-document.ts");
const data = {
  nomor_surat: "123", tgl_surat: "05 Oktober 2026", nama_pegawai: "PEGAWAI UJI", nip: "200001012020011001",
  tgl_lahir: "01 Januari 2000", pangkat_gol: "Penata Muda / III/a", gaji_lama: "Rp 3.000.000",
  terbilang_gaji_lama: "tiga juta rupiah", pejabat_kgb_lama: "Kepala Dinas", nomor_kgb_lama: "800.1.11.13/100-Sekre",
  tgl_kgb_lama: "01 Oktober 2024", tmt_kgb_lama: "01 November 2024", mkg_tahun_lama: 4, mkg_bulan_lama: 0,
  mkg_tahun_baru: 6, mkg_bulan_baru: 0, gaji_baru: "Rp 3.200.000", terbilang_gaji_baru: "tiga juta dua ratus ribu rupiah",
  tmt_kgb_baru: "01 November 2026", tmt_kgb_depan: "01 November 2028",
};
const legacy = new PizZip(await generateKgbDocument(data));
const classified = new PizZip(await generateKgbDocument({ ...data, nomor_surat: "800.1.11.13/123-Sekre" }));
const otherCode = new PizZip(await generateKgbDocument({ ...data, nomor_surat: "800.1.11.1/456/2026" }));
function textOf(zip) {
  return [...zip.file("word/document.xml").asText().matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join("");
}
assert.equal(textOf(classified), textOf(legacy), "Classified KGB must have the same visible content as legacy output");
assert.equal(textOf(classified).split("800.1.11.13/123-Sekre").length - 1, 1);
assert(textOf(otherCode).includes("800.1.11.1/456/2026"));
assert(!textOf(otherCode).includes("456/2026-Sekre"));
assert(!textOf(classified).includes("&lt;&lt;"), "No template tags left behind");
for (const [name, entry] of Object.entries(legacy.files)) {
  if (entry.dir || name === "word/document.xml") continue;
  assert(entry.asNodeBuffer().equals(classified.file(name).asNodeBuffer()), `KGB part changed: ${name}`);
}
console.log("PASS full KGB number once, legacy compatibility, and unchanged remaining ZIP parts");

const cases = [];
const pengantarNumber = "800.1.6.6/123-Sekre";
cases.push(["Pengantar", pengantarNumber, await load("src/lib/surat-pengantar-document.ts").generateSuratPengantarDocument({
  tanggal: "05 Oktober 2026", "no surat": pengantarNumber, no: "1", "file yang dikirim": "Berkas usulan pensiun", jumlah: "1",
})]);
const wfhNumber = "800.1.11.1/123-Sekre";
cases.push(["WFH", wfhNumber, await load("src/lib/wfh-document.ts").generateWfhDocument({
  "800.1.11.1/2677/Sekre": wfhNumber, Agustus: "Oktober", "04 Agustus 2026": "05 Oktober 2026",
})]);
for (const type of ["hukdis", "hukda"]) {
  const number = `${catalog.letterClassificationDefaults[type]}/123-Sekre`;
  cases.push([type, number, await load("src/lib/official-statement-document.ts").generateOfficialStatementDocument(type, {
    no_surat: number, nama_pegawai: "PEGAWAI UJI", nip_pegawai: "20000101 202001 1 001", pangkat_gol_pegawai: "Penata Muda / III/a",
    jabatan_pegawai: "Pelaksana", tgl_surat: "05 Oktober 2026",
  })]);
}
const kerjakuNumber = "800.1.5.2/123-Sekret";
cases.push(["Kerjaku", kerjakuNumber, await load("src/lib/pembukaan-kerjaku-document.ts").generatePembukaanKerjakuDocument({
  tanggalSurat: "2026-10-05", nomorSurat: kerjakuNumber, bulanDibuka: "2026-09",
  employees: [{ nip: "200001012020011001", name: "PEGAWAI UJI", position: "Pelaksana" }],
})]);
const pakNumber = "800.1.4.5/123/PAK/2026";
cases.push(["PAK", pakNumber, await load("src/lib/pak-document.ts").generatePakDocument({
  nip: "200001012020011001", nomor: pakNumber, tanggal: "2026-10-05", tempatPenetapan: "Indramayu", instansi: "Pemerintah Kab. Indramayu",
  kartuAsn: "UJI", tempatLahir: "INDRAMAYU", tanggalLahir: "2000-01-01", jenisKelamin: "Pria", pangkat: "Penata", golongan: "III/c",
  tmtPangkat: "2024-01-01", jabatan: "Penyuluh Pertanian Ahli Muda", tmtJabatan: "2024-01-01", unitKerja: "DINAS KETAHANAN PANGAN DAN PERTANIAN",
  penilaiNama: "PENILAI UJI", penilaiNip: "198001012005011001", period: { year: 2025, startMonth: 1, endMonth: 12, level: "Ahli Muda", predicate: "Baik" },
  history: [], components: load("src/lib/pak.ts").emptyPakComponents(), rankMinimum: 100, levelMinimum: 200,
}, "PEGAWAI UJI")]);
for (const [name, number, buffer] of cases) {
  const text = textOf(new PizZip(buffer));
  assert(text.includes(number), `${name} output missing classified number`);
}
console.log("PASS classified numbers printed by all other letter generators");
if (process.argv.includes("--write-fixture")) {
  const directory = path.join(root, ".tmp/letter-classification/generated");
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, "kgb-classified.docx"), classified.generate({ type: "nodebuffer" }));
}
