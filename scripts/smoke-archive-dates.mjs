import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url), modules = new Map();
let dateValue = "8 September 2026", certainty = "high";
function load(file) {
  const filename = path.resolve(file); if (modules.has(filename)) return modules.get(filename).exports;
  const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); modules.set(filename, mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name === "@/lib/gemini-client") return {
      GeminiApiError: class extends Error {},
      requestGeminiJson: async () => ({ model: "fixture", value: {
        values: { namaDokumen: "Surat Uji", nomor: "UJI/2026", jenisDokumen: "Surat", tglDokumen: dateValue },
        confidence: { namaDokumen: "high", nomor: "high", jenisDokumen: "high", ...(certainty ? { tglDokumen: certainty } : {}) }, warnings: [], identityMismatch: false,
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
const extract = () => extractGeminiDocumentData({ kind: "official-archive", files: [new File(["%PDF-1.4\n%%EOF"], "Uji.pdf")], context: {} });
let result = await extract(); assert.equal(result.values.tglDokumen, "2026-09-08"); assert.equal(result.confidence.tglDokumen, "high");
for (const value of ["", "Tidak ditemukan", "31 September 2026", "September 2026", "8 September 2026 atau 9 September 2026"]) {
  dateValue = value; result = await extract(); assert.equal(result.values.tglDokumen, ""); assert.equal(result.confidence.tglDokumen, "low");
  assert(result.warnings.some(w => w.includes("tanggal dokumen secara manual")));
}
dateValue = "2026-09-08";
for (const confidence of ["low", ""]) { certainty = confidence; result = await extract(); assert.equal(result.values.tglDokumen, ""); assert(result.warnings.length); }
certainty = "medium"; assert.equal((await extract()).values.tglDokumen, "2026-09-08");
console.log("PASS archive dates: Indonesian/numeric/ISO normalization, day-first order, leap years, invalid/partial/ambiguous-date rejection, confidence gating and explicit manual-date warnings without a fabricated current date.");
