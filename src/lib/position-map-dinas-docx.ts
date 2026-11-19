import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import slots from "@/data/position-map-dinas-a4-slots.json";
import type { PositionMapPlan } from "@/lib/position-map-model";
import { signatoryTitle, type Signatory } from "@/lib/signatory";

const textPattern = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const decode = (value: string) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const encode = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plainText = (xml: string) => [...xml.matchAll(textPattern)].map(match => decode(match[2])).join("");

// Patch only the text range, including ranges split across Word runs. Keep the
// source's run/paragraph properties, line breaks, anchors and all other parts.
function replaceText(xml: string, source: string | RegExp, value: string) {
  const nodes = [...xml.matchAll(textPattern)], texts = nodes.map(match => decode(match[2])), text = texts.join("");
  const found = typeof source === "string" ? { index: text.indexOf(source), value: source } : (() => { const match = source.exec(text); return match ? { index: match.index, value: match[0] } : null; })();
  if (!found || found.index < 0 || !found.value.length) throw new Error("Slot template peta jabatan A4 tidak sesuai.");
  if (found.value === value) return xml;
  const start = found.index, end = start + found.value.length;
  let cursor = 0;
  for (let i = 0; i < texts.length; i++) {
    const next = cursor + texts[i].length;
    if (cursor < end && next > start) texts[i] = texts[i].slice(0, Math.max(0, start - cursor))
      + (cursor <= start ? value : "") + texts[i].slice(Math.min(texts[i].length, end - cursor));
    cursor = next;
  }
  let index = 0;
  return xml.replace(textPattern, (original, attributes: string | undefined, encoded: string) => {
    const replacement = texts[index++];
    return replacement === decode(encoded) ? original : `<w:t${attributes ?? ""}>${encode(replacement)}</w:t>`;
  });
}

/** The user's edited DOCX is the layout authority for this export. */
export function createDinasA4PositionMapDocx(plan: PositionMapPlan, year: number, signatory: Signatory): Buffer {
  const zip = new PizZip(readFileSync(path.join(process.cwd(), "src", "templates", "template-position-map-dinas-a4.docx")));
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Template peta jabatan A4 tidak lengkap.");
  const byShape = new Map(slots.map(slot => [slot.shape, slot])), patched = new Set<string>();
  const xml = file.asText().replace(/<v:shape(?=[\s>])[^>]*>[\s\S]*?<\/v:shape>/g, shape => {
    const id = /\bid="([^"]+)"/.exec(shape)?.[1] ?? "", slot = byShape.get(id);
    if (id === "MapText115") { patched.add(id); return replaceText(shape, /Tahun \d{4}/, `Tahun ${year}`); }
    if (!slot && id !== "MapText114") return shape;
    patched.add(id);
    let rowIndex = 0;
    return shape.replace(/<w:tr(?=[\s>])[^>]*>[\s\S]*?<\/w:tr>/g, row => {
      const r = rowIndex++;
      if (id === "MapText114") {
        if (r === 0) return replaceText(row, "Plt. KEPALA DINAS KETAHANAN PANGAN DAN PERTANIAN", signatoryTitle(signatory).replace(/\s+KABUPATEN INDRAMAYU$/i, ""));
        // Keep the literal ${ttd_pengirim} marker in row 1 exactly as supplied.
        if (r === 1) return row;
        const value = [signatory.name, signatory.rank ?? "", signatory.nip ? `NIP. ${signatory.nip}` : ""][r - 2];
        if (value === undefined) throw new Error("Blok tanda tangan template A4 tidak sesuai.");
        return replaceText(row, plainText(row), value);
      }
      if (!slot || r === 0) return row;
      const role = slot.roles[slot.kind === "head" ? 0 : r - 1], counts = plan.positions[role];
      if (!counts) throw new Error("Jabatan pada template A4 tidak ditemukan dalam peta.");
      const balance = counts.staffed - counts.required;
      if (slot.kind === "head") return replaceText(row, /K: \d+\s+B: \d+\s+\+\/-: -?\d+/, `K: ${counts.required}     B: ${counts.staffed}     +/-: ${balance}`);
      let column = 0;
      return row.replace(/<w:tc(?=[\s>])[^>]*>[\s\S]*?<\/w:tc>/g, cell => {
        const c = column++;
        return c === 0 ? cell : replaceText(cell, /^-?\d+$/, String([counts.required, counts.staffed, balance][c - 1]));
      });
    });
  });
  if (patched.size !== slots.length + 2) throw new Error("Sebagian slot template peta jabatan A4 tidak ditemukan.");
  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
