import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url), modules = new Map();
let dateValue = "8 September 2026", certainty = "high";
let modelValues, modelConfidence, mismatch = false;
function load(file) {
  const filename = path.resolve(file); if (modules.has(filename)) return modules.get(filename).exports;
  const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); modules.set(filename, mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name === "@/lib/gemini-client") return {
      GeminiApiError: class extends Error {},
      requestGeminiJson: async () => ({ model: "fixture", value: {
        values: modelValues ?? { namaDokumen: "Surat Uji", nomor: "UJI/2026", jenisDokumen: "Surat", tglDokumen: dateValue },
        confidence: modelConfidence ?? { namaDokumen: "high", nomor: "high", jenisDokumen: "high", ...(certainty ? { tglDokumen: certainty } : {}) }, warnings: [], identityMismatch: mismatch,
      } }),
    };
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const { normalizeDocumentDate } = load("src/lib/document-date.ts");
for (const [input, expected] of [
  ["8 September 2026", "2026-09-08"], ["08 SEPT. 2026", "2026-09-08"], ["Tanggal: 8 September 2026", "2026-09-08"],
  [" 9  Oktober  2026 ", "2026-10-09"], ["09/10/2026", "2026-10-09"], ["9-10-2026", "2026-10-09"], ["9.10.2026", "2026-10-09"],
  ["2026-10-09", "2026-10-09"], ["2026/10/9", "2026-10-09"], ["29 Februari 2024", "2024-02-29"], ["28 Agu 2026", "2026-08-28"],
  ["1 Mei 2026", "2026-05-01"], ["31 Desember 2026", "2026-12-31"], ["8 September", ""], ["2026", ""], ["09/10/26", ""],
  ["29 Februari 2026", ""], ["31 April 2026", ""], ["32 Oktober 2026", ""], ["2026-02-30", ""], ["", ""],
  ["8 September 2026 atau 9 September 2026", ""], ["2026-10-09T00:00:00Z", ""], ["10/28/2026", ""],
]) assert.equal(normalizeDocumentDate(input), expected, input);
const { extractGeminiDocumentData } = load("src/lib/gemini-document-ai.ts");
const extract = (kind = "official-archive") => extractGeminiDocumentData({ kind, files: [new File(["%PDF-1.4\n%%EOF"], "Uji.pdf")], context: { nip: "200001012020121099" } });
let result = await extract(); assert.equal(result.values.tglDokumen, "2026-09-08"); assert.equal(result.confidence.tglDokumen, "high");
for (const value of ["", "Tidak ditemukan", "31 September 2026", "September 2026", "8 September 2026 atau 9 September 2026"]) {
  dateValue = value; result = await extract(); assert.equal(result.values.tglDokumen, ""); assert.equal(result.confidence.tglDokumen, "low");
  assert(result.warnings.some(w => w.includes("tanggal dokumen secara manual")));
}
dateValue = "2026-09-08";
for (const confidence of ["low", ""]) { certainty = confidence; result = await extract(); assert.equal(result.values.tglDokumen, ""); assert(result.warnings.length); }
certainty = "medium"; assert.equal((await extract()).values.tglDokumen, "2026-09-08");
for (const [kind, fields] of [
  ["employee-document", { tglSurat: ["17 Februari 2025", "2025-02-17"], tmtSurat: ["01/04/2025", "2025-04-01"] }],
  ["dpcp", { tmtpns: ["1 Maret 2005", "2005-03-01"], tglPasangan: ["12 Juni 1984", "1984-06-12"], tglNikah: ["09/04/2007", "2007-04-09"], tglAnak1: ["29 Februari 2008", "2008-02-29"], tglAnak2: ["3 Des 2012", "2012-12-03"] }],
  ["plt-assignment", { startDate: ["9 April 2027", "2027-04-09"] }],
]) {
  modelValues = { namaPasangan: "Pasangan Uji", namaAnak1: "Anak Uji Satu", namaAnak2: "Anak Uji Dua", ...Object.fromEntries(Object.entries(fields).map(([key, pair]) => [key, pair[0]])) };
  modelConfidence = Object.fromEntries(Object.keys(modelValues).map(key => [key, "high"]));
  result = await extract(kind); for (const [field, pair] of Object.entries(fields)) assert.equal(result.values[field], pair[1], `${kind}/${field}`);
  for (const field of Object.keys(fields)) {
    const original = modelValues[field];
    modelValues[field] = "31 Februari 2026"; result = await extract(kind); assert.equal(result.values[field], ""); assert(result.warnings.length);
    modelValues[field] = original; modelConfidence[field] = "low"; assert.equal((await extract(kind)).values[field], "");
    delete modelConfidence[field]; assert.equal((await extract(kind)).values[field], ""); modelConfidence[field] = "high";
  }
  mismatch = true; result = await extract(kind); assert(Object.values(result.values).every(value => value === "")); mismatch = false;
}
const { fillEmptyDocumentFields } = load("src/lib/document-ai-fields.ts");
const source = { values: { tglSurat: "17 Februari 2025", tmtSurat: "1 April 2025", tglDpcp: "2000-01-01", nomorSurat: "AI" }, confidence: { tglSurat: "high", tmtSurat: "high" } };
let merged = fillEmptyDocumentFields({ tglSurat: "2024-08-17", tmtSurat: "", nomorSurat: "Manual", tglDpcp: "2026-10-28" }, source, ["tglSurat", "tmtSurat", "nomorSurat"]);
assert.equal(merged.values.tglSurat, "2024-08-17"); assert.equal(merged.values.tmtSurat, "2025-04-01"); assert.equal(merged.values.nomorSurat, "Manual"); assert.equal(merged.values.tglDpcp, "2026-10-28");
source.confidence.tmtSurat = "low"; merged = fillEmptyDocumentFields({ tmtSurat: "" }, source, ["tmtSurat"]); assert.equal(merged.values.tmtSurat, "");
console.log("PASS all Gemini dates: all nine date fields across archive/employee/DPCP/Plt, Indonesian/numeric/ISO formats, leap years, invalid/partial/ambiguous dates, low/missing confidence, identity mismatch, manual/stored values and document-generation date preservation.");
