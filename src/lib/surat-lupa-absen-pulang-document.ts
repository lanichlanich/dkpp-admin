import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { formatIndonesianDate } from "@/lib/kgb";
import type { SuratLupaAbsenEmployee } from "@/lib/surat-lupa-absen-pulang";

const paragraphPattern = /<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g;
const textPattern = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;

function decodeXml(value: string) {
  return value.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function encodeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function replaceTagsInParagraph(paragraphXml: string, replacements: Record<string, string>) {
  const matches = [...paragraphXml.matchAll(textPattern)];
  if (!matches.length) return paragraphXml;
  const texts = matches.map((match) => decodeXml(match[2]));
  for (const [tagText, replacement] of Object.entries(replacements)) {
    const tag = `<${tagText}>`;
    let start = texts.join("").indexOf(tag);
    while (start !== -1) {
      const end = start + tag.length;
      let cursor = 0;
      let startNode = -1;
      let endNode = -1;
      let startOffset = 0;
      let endOffset = 0;
      for (let index = 0; index < texts.length; index += 1) {
        const next = cursor + texts[index].length;
        if (startNode === -1 && start >= cursor && start < next) {
          startNode = index;
          startOffset = start - cursor;
        }
        if (endNode === -1 && end > cursor && end <= next) {
          endNode = index;
          endOffset = end - cursor;
          break;
        }
        cursor = next;
      }
      if (startNode === -1 || endNode === -1) break;
      if (startNode === endNode) texts[startNode] = `${texts[startNode].slice(0, startOffset)}${replacement}${texts[startNode].slice(endOffset)}`;
      else {
        texts[startNode] = `${texts[startNode].slice(0, startOffset)}${replacement}`;
        for (let index = startNode + 1; index < endNode; index += 1) texts[index] = "";
        texts[endNode] = texts[endNode].slice(endOffset);
      }
      start = texts.join("").indexOf(tag);
    }
  }
  let index = 0;
  return paragraphXml.replace(textPattern, (_full, attributes: string | undefined) =>
    `<w:t${attributes ?? ""}>${encodeXml(texts[index++])}</w:t>`);
}

export async function generateSuratLupaAbsenPulangDocument(input: {
  employee: SuratLupaAbsenEmployee;
  absenceDate: string;
  letterDate: string;
  reason: string;
  supervisor: SuratLupaAbsenEmployee;
}) {
  const template = await readFile(path.join(process.cwd(), "src", "templates", "template-surat-lupa-absen-pulang.docx"));
  const zip = new PizZip(template);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("Template Surat Lupa Absen Pulang tidak memiliki document.xml.");
  const replacements = {
    nama_pegawai: input.employee.name,
    nip_pegawai: input.employee.nip,
    jabatan: input.employee.position,
    tgl_lupa_absen: formatIndonesianDate(input.absenceDate),
    alasan: input.reason,
    tgl_surat: formatIndonesianDate(input.letterDate),
    jabatan_atasan: input.supervisor.position,
    nama_atasan: input.supervisor.name,
    nip_atasan: input.supervisor.nip,
  };
  const renderedXml = documentFile.asText().replace(paragraphPattern, (paragraph) => replaceTagsInParagraph(paragraph, replacements));
  const visibleText = [...renderedXml.matchAll(textPattern)].map((match) => decodeXml(match[2])).join("");
  const leftover = visibleText.match(/<[^<>]{1,120}>/);
  if (leftover) throw new Error(`Tag template belum terisi: ${leftover[0]}`);
  for (const value of Object.values(replacements)) {
    if (value && !visibleText.includes(value)) throw new Error("Sebagian data tidak ditemukan di dokumen yang dibuat.");
  }
  zip.file("word/document.xml", renderedXml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
