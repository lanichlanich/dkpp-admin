import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { registerHooks } from "node:module";

const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  return next(specifier === "./pdf-tools-config" ? "./pdf-tools-config.ts" : specifier, context);
} });
const archive = await import("../src/lib/pdf-tools-documents.ts").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") assert.fail(`Archive store not implemented: ${error.message}`);
  throw error;
});
hook.deregister();
const { savePdfToolDocuments, listPdfToolDocuments, readPdfToolDocument, renamePdfToolDocument, deletePdfToolDocument, PDF_TOOLS_DOCUMENT_CAP } = archive;
const original = process.cwd();
const tmp = await mkdtemp(join(tmpdir(), "pdf-tools-documents-"));

try {
  process.chdir(tmp);
  const owner = `smoke-${randomUUID()}`;
  const other = `smoke-${randomUUID()}`;
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = Buffer.from(await pdf.save());
  const result = name => ({ name, bytes, pages: 1 });
  assert.deepEqual(await listPdfToolDocuments(owner), []);
  const parts = await savePdfToolDocuments(owner, "split", [result("Bagian 1.pdf"), result("Bagian 2.pdf")]);
  const [otherDoc] = await savePdfToolDocuments(other, "merge", [result("Gabungan.pdf")]);
  const [compressed] = await savePdfToolDocuments(owner, "compress", [result("Kompres.pdf")]);
  for (const { id } of [...parts, otherDoc, compressed]) assert.match(id, /^[\da-f-]{36}$/);
  const ownRows = await listPdfToolDocuments(owner);
  assert.deepEqual(new Set(ownRows.map(row => row.id)), new Set([...parts.map(p => p.id), compressed.id]));
  assert.equal(ownRows.find(row => row.id === parts[0].id).operation, "split");
  assert.ok(ownRows.every(row => !("ownerId" in row) && !("bytes" in row) && row.pages === 1 && row.size === bytes.length));
  assert.deepEqual((await listPdfToolDocuments(other)).map(row => row.id), [otherDoc.id]);
  const id = parts[0].id;
  assert.deepEqual((await readPdfToolDocument(owner, id)).bytes, bytes);
  assert.equal(await readPdfToolDocument(other, id), null);
  assert.equal(await renamePdfToolDocument(other, id, "Pribadi"), null);
  assert.equal(await deletePdfToolDocument(other, id), false);
  assert.equal(await readPdfToolDocument(owner, "../../secret"), null);
  await assert.rejects(renamePdfToolDocument(owner, id, "../private.pdf"), /nama/i);
  await assert.rejects(renamePdfToolDocument(owner, id, "\ud800"), /nama/i);
  assert.equal((await renamePdfToolDocument(owner, id, "Dokumén 'baru' ")).name, "Dokumén 'baru'.pdf");
  assert.equal((await readPdfToolDocument(owner, id)).name, "Dokumén 'baru'.pdf");
  assert.deepEqual((await readPdfToolDocument(owner, id)).bytes, bytes);
  assert.equal(await deletePdfToolDocument(owner, id), true);
  assert.equal(await deletePdfToolDocument(owner, id), false);
  assert.equal(await readPdfToolDocument(owner, id), null);
  assert.deepEqual((await readPdfToolDocument(owner, parts[1].id)).bytes, bytes);
  assert.equal(await deletePdfToolDocument(owner, parts[1].id), true);
  assert.equal(await readPdfToolDocument(other, otherDoc.id).then(row => row.name), "Gabungan.pdf");
  await assert.rejects(savePdfToolDocuments(owner, "unknown", [result("unused.pdf")]));
  await assert.rejects(savePdfToolDocuments(owner, "merge", [result("a.pdf"), result("b.pdf")]));
  await assert.rejects(savePdfToolDocuments(owner, "split", [result("valid.pdf"), result("../invalid.pdf")]));
  assert.equal((await listPdfToolDocuments(owner)).length, 1);
  for (let remaining = PDF_TOOLS_DOCUMENT_CAP - 1; remaining > 0; remaining -= 100) {
    await savePdfToolDocuments(owner, "split", Array.from({ length: Math.min(100, remaining) }, () => result("Kap.pdf")));
  }
  await assert.rejects(savePdfToolDocuments(owner, "compress", [result("Penuh.pdf")]), /arsip.*penuh/i);
  assert.equal((await listPdfToolDocuments(owner)).length, PDF_TOOLS_DOCUMENT_CAP);
  assert.equal((await listPdfToolDocuments(other)).length, 1);
  const root = join(tmp, "data", "pdf-tools-documents");
  assert.equal((await stat(root)).mode & 0o777, 0o700);
  for (const entry of await readdir(root, { recursive: true })) {
    const info = await stat(join(root, entry));
    assert.equal(info.mode & 0o777, info.isDirectory() ? 0o700 : 0o600, entry);
    assert.doesNotMatch(entry, /Bagian|Gabungan|Dokumén|smoke-|^\./);
  }
  console.log("PASS PDF archive store: outputs only, owner isolation, atomic batch validation, UUIDs, Unicode rename, delete, private permissions, per-owner quota");
} finally {
  process.chdir(original);
  await rm(tmp, { recursive: true, force: true });
}
