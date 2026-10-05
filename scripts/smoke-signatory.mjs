import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import PizZip from "pizzip";
import ts from "typescript";

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
    if (["@/lib/database", "@/lib/storage"].includes(specifier)) return new Proxy({}, { get: () => { throw new Error("Persistence is not allowed in this smoke test."); } });
    if (specifier.startsWith("@/")) return load(`src/${specifier.slice(2)}${path.extname(specifier) ? "" : ".ts"}`);
    return require(specifier);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const { DEFAULT_SIGNATORY, signatorySchema, signatoryTitle, signatoryRank } = load("src/lib/signatory.ts");
const { applySignatoryToTemplate } = load("src/lib/signatory-document.ts");
const chosen = { name: "PEJABAT UJI & GELAR", nip: "198001012005011001", rank: "IV/a / Pembina", title: "SEKRETARIS DINAS", status: "plt" };
assert.deepEqual(signatoryRank(chosen.rank), { name: "Pembina", full: "Pembina / IV/a" });
assert.equal(signatoryTitle({ ...chosen, title: "Plt. SEKRETARIS DINAS" }), "Plt. SEKRETARIS DINAS");
assert.equal(signatoryTitle({ ...chosen, status: "definitif" }), "SEKRETARIS DINAS");
for (const change of [{ name: "" }, { nip: "123" }, { title: "" }, { status: "unknown" }, { name: "<tag>" }, { title: "baris\nbaru" }]) assert.equal(signatorySchema.safeParse({ ...chosen, ...change }).success, false);
assert(signatorySchema.safeParse(DEFAULT_SIGNATORY).success);
for (const [file, schema] of [["kgb-validation.ts", "kgbSchema"], ["wfh-validation.ts", "wfhSchema"], ["official-statement-validation.ts", "officialStatementSchema"], ["surat-pengantar-validation.ts", "suratPengantarSchema"], ["dpcp-validation.ts", "dpcpSchema"], ["pembukaan-kerjaku.ts", "kerjakuRequestSchema"], ["pak-validation.ts", "pakSchema"]]) {
  const field = load(`src/lib/${file}`)[schema].shape.signatory;
  assert(field.safeParse(chosen).success);
  assert.equal(field.safeParse({ ...chosen, nip: "123" }).success, false, file);
}
console.log("PASS signatory identity/status validation on all seven forms");

const textPattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const visible = (xml) => [...xml.matchAll(textPattern)].map((match) => match[1].replace(/&amp;/g, "&")).join("");
const structure = (xml) => xml.replace(textPattern, "<w:t>TEXT</w:t>");
const templates = ["kgb", "wfh", "surat-pengantar", "hukdis", "hukda", "pembukaan-kerjaku", "dpcp", "pak"];
for (const template of templates) {
  const source = new PizZip(readFileSync(path.join(root, `src/templates/template-${template}.docx`)));
  const before = source.file("word/document.xml").asText();
  for (const signer of [chosen, { ...chosen, status: "definitif" }, DEFAULT_SIGNATORY]) {
    const zip = new PizZip(readFileSync(path.join(root, `src/templates/template-${template}.docx`)));
    applySignatoryToTemplate(zip, signer, template === "pak" || template === "dpcp" ? template : "letter");
    const after = zip.file("word/document.xml").asText();
    const text = visible(after);
    assert(text.replace(/\s/g, "").includes(signatoryTitle(signer).replace(/\s/g, "")), `${template}: missing chosen title`);
    if (template !== "pak") {
      assert(text.includes(signer.name), `${template}: missing chosen name`);
      assert(!/SUGENG\s+HERYANTO/i.test(text), `${template}: stale head name`);
      assert(!text.replace(/\D/g, "").includes("196609231987091001"), `${template}: stale NIP`);
      assert(!text.includes("Pembina Utama Muda"), `${template}: stale rank`);
      if (signer.nip) assert(text.includes(signer.nip), `${template}: missing selected NIP`);
    }
    assert.equal(structure(after), structure(before), `${template}: formatting or structure changed`);
    if (before.includes("${ttd_pengirim}")) assert(text.includes("${ttd_pengirim}"));
    for (const [name, part] of Object.entries(source.files)) if (!part.dir && name !== "word/document.xml") assert(part.asNodeBuffer().equals(zip.file(name).asNodeBuffer()), `${template}: changed ZIP part ${name}`);
  }
}
console.log("PASS eight templates, Definitif/Plt., no stale name/NIP/rank, unchanged formatting/ZIP parts/TTE");

const { generateDpcpDocument } = load("src/lib/dpcp-document.ts");
const dpcpTemplate = new PizZip(readFileSync(path.join(root, "src/templates/template-dpcp.docx"))).file("word/document.xml").asText();
const fields = {};
for (const match of visible(dpcpTemplate).replace(/&lt;/g, "<").replace(/&gt;/g, ">").matchAll(/<([^<>]+)>/g)) fields[match[1]] = "ISIAN UJI";
fields.nama_kadis = "NAMA LAMA YANG TIDAK BOLEH DIPAKAI";
fields.nip_kadis = "000000000000000000";
const dpcp = new PizZip(await generateDpcpDocument(fields, chosen));
assert(visible(dpcp.file("word/document.xml").asText()).includes(chosen.name));
assert(!visible(dpcp.file("word/document.xml").asText()).includes(fields.nama_kadis));
console.log("PASS DPCP selected identity replaces legacy automatic head data");

if (process.argv.includes("--write-fixture")) {
  const buffer = await load("src/lib/kgb-document.ts").generateKgbDocument({
    nomor_surat: "800.1.11.13/123-Sekre", nama_pegawai: "PEGAWAI UJI", nip: "200001012020011001", tgl_surat: "05 Oktober 2026",
    tgl_lahir: "01 Januari 2000", pangkat_gol: "Penata Muda / III/a", gaji_lama: "Rp 3.000.000", terbilang_gaji_lama: "tiga juta rupiah",
    pejabat_kgb_lama: "Kepala Dinas", nomor_kgb_lama: "800.1.11.13/100-Sekre", tgl_kgb_lama: "01 Oktober 2024", tmt_kgb_lama: "01 November 2024",
    mkg_tahun_lama: 4, mkg_bulan_lama: 0, mkg_tahun_baru: 6, mkg_bulan_baru: 0, gaji_baru: "Rp 3.200.000", terbilang_gaji_baru: "tiga juta dua ratus ribu rupiah",
    tmt_kgb_baru: "01 November 2026", tmt_kgb_depan: "01 November 2028",
  }, { ...chosen, name: DEFAULT_SIGNATORY.name, title: DEFAULT_SIGNATORY.title, rank: "Pembina Tk.I / IV/b" });
  const directory = path.join(root, ".tmp/signatory/generated");
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, "kgb-plt.docx"), buffer);
}
