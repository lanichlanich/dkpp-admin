import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { z } from "zod";

const require = createRequire(import.meta.url);
const modules = new Map();
function load(file) {
  const filename = path.resolve(file);
  if (modules.has(filename)) return modules.get(filename).exports;
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  modules.set(filename, mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}

const { requestOpenAiJson, openAiFile, OpenAiApiError } = load("src/lib/openai-client.ts");
const { generateWfhTasks } = load("src/lib/wfh-report-ai.ts");
const schema = z.object({ rows: z.array(z.object({ note: z.string().optional() })).max(4) });
const content = [
  { type: "input_text", text: "data sumber" },
  openAiFile("sumber.pdf", "application/pdf", Buffer.from("%PDF-")),
  openAiFile("scan.png", "image/png", Buffer.from("scan")),
];
const request = () => requestOpenAiJson("Petunjuk pengujian", content, schema);
const message = (...parts) => ({
  status: "completed",
  model: "test-snapshot",
  output: [{ type: "reasoning" }, { type: "message", role: "assistant", content: parts }],
});
const responseText = text => ({ type: "output_text", text });
const rejectsWith = (fn, status, messagePattern) => assert.rejects(fn, error =>
  error instanceof OpenAiApiError && error.status === status && messagePattern.test(error.message) && !error.message.includes("private upstream detail"));

delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_MODEL;
globalThis.fetch = () => assert.fail("Unexpected network request");
await rejectsWith(request, 503, /belum dikonfigurasi/);

process.env.OPENAI_API_KEY = "mock-token";
globalThis.fetch = async (url, options) => {
  assert.equal(url, "https://api.openai.com/v1/responses");
  assert.equal(options.method, "POST");
  assert.equal(options.headers.Authorization, "Bearer mock-token");
  assert.equal(options.cache, "no-store");
  assert(options.signal instanceof AbortSignal);
  const body = JSON.parse(options.body);
  assert.equal(body.model, "gpt-5.4-mini");
  assert.equal(body.store, false);
  assert.equal(body.instructions, "Petunjuk pengujian");
  assert(!options.body.includes("mock-token"));
  assert.deepEqual(body.input, [{ role: "user", content: [
    { type: "input_text", text: "data sumber" },
    { type: "input_file", filename: "sumber.pdf", file_data: "data:application/pdf;base64,JVBERi0=", detail: "high" },
    { type: "input_image", image_url: "data:image/png;base64,c2Nhbg==", detail: "high" },
  ] }]);
  assert.deepEqual(body.text.format, { type: "json_schema", name: "result", strict: true, schema: {
    type: "object", required: ["rows"], additionalProperties: false, properties: { rows: {
      type: "array", maxItems: 4, items: {
        type: "object", required: ["note"], additionalProperties: false, properties: { note: { type: "string" } },
      },
    } },
  } });
  return Response.json(message(responseText('{"rows":['), responseText('{"note":"uji"}]}')));
};
assert.deepEqual(await request(), { model: "test-snapshot", value: { rows: [{ note: "uji" }] } });

const tasks = Array.from({ length: 4 }, (_, index) => ({ activity: `Tugas ${index + 1}`, targetOutput: "Draf laporan" }));
process.env.OPENAI_MODEL = " configured-model ";
globalThis.fetch = async (_url, options) => {
  const body = JSON.parse(options.body);
  assert.equal(body.model, "configured-model");
  assert.deepEqual(JSON.parse(body.input[0].content[0].text), { jabatan: "Analis", unitKerja: "Unit Contoh" });
  assert.deepEqual(body.text.format.schema.properties.tasks.items.required, ["activity", "targetOutput"]);
  return Response.json(message(responseText(JSON.stringify({ tasks }))));
};
assert.deepEqual(await generateWfhTasks({ name: "Nama internal", nip: "123", position: "Analis", unit: "Unit Contoh" }), { model: "test-snapshot", tasks });

for (const [status, expected, pattern] of [[429, 429, /Kuota/], [401, 503, /menolak akses/], [403, 503, /menolak akses/], [404, 503, /Model/], [500, 502, /Layanan/]]) {
  globalThis.fetch = async () => Response.json({ error: "private upstream detail" }, { status });
  await rejectsWith(request, expected, pattern);
}
globalThis.fetch = async () => { throw new Error("private upstream detail"); };
await rejectsWith(request, 504, /waktu tunggu/);
globalThis.fetch = async () => Response.json({ status: "incomplete", output: [] });
await rejectsWith(request, 502, /tidak lengkap/);
globalThis.fetch = async () => Response.json(message({ type: "refusal", refusal: "private upstream detail" }));
await rejectsWith(request, 422, /tidak dapat memproses/);
globalThis.fetch = async () => Response.json(message(responseText("invalid JSON")));
await rejectsWith(request, 502, /tidak sesuai format/);
console.log("PASS OpenAI Responses: server key, structured output, PDF/image encoding, WFH input scope, refusal, quota and timeout.");
