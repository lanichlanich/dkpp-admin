import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import type { OfficialStatementType } from "@/lib/official-statement-validation";

const paragraphPattern = /<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g;
const textPattern = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const templateNames: Record<OfficialStatementType, string> = {
  hukdis: "template-hukdis.docx",
  hukda: "template-hukda.docx",
};

function decodeXml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function replaceTagsInParagraph(paragraphXml: string, replacements: Record<string, string>) {
  const matches = [...paragraphXml.matchAll(textPattern)];
  if (matches.length === 0) return paragraphXml;
  const texts = matches.map((match) => decodeXml(match[2]));

  for (const [tagText, replacement] of Object.entries(replacements)) {
    const tag = `<${tagText}>`;
    let joined = texts.join("");
    let start = joined.indexOf(tag);
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
      if (startNode === endNode) {
        texts[startNode] = `${texts[startNode].slice(0, startOffset)}${replacement}${texts[startNode].slice(endOffset)}`;
      } else {
        texts[startNode] = `${texts[startNode].slice(0, startOffset)}${replacement}`;
        for (let index = startNode + 1; index < endNode; index += 1) texts[index] = "";
        texts[endNode] = texts[endNode].slice(endOffset);
      }
      joined = texts.join("");
      start = joined.indexOf(tag);
    }
  }

  let index = 0;
  return paragraphXml.replace(textPattern, (_full, attributes: string | undefined) => {
    const value = texts[index++];
    return `<w:t${attributes ?? ""}>${encodeXml(value)}</w:t>`;
  });
}

function visibleDocumentText(documentXml: string) {
  return [...documentXml.matchAll(textPattern)].map((match) => decodeXml(match[2])).join("");
}

function visibleAngleTags(documentXml: string) {
  const tags = new Set<string>();
  for (const paragraph of documentXml.matchAll(paragraphPattern)) {
    const text = [...paragraph[0].matchAll(textPattern)].map((match) => decodeXml(match[2])).join("");
    for (const tag of text.matchAll(/<([^<>]{1,120})>/g)) tags.add(tag[1]);
  }
  return [...tags];
}

export function formatOfficialNip(nip: string) {
  const digits = nip.replace(/\D/g, "");
  if (digits.length !== 18) return nip;
  return `${digits.slice(0, 8)} ${digits.slice(8, 14)} ${digits.slice(14, 15)} ${digits.slice(15)}`;
}

export async function generateOfficialStatementDocument(
  documentType: OfficialStatementType,
  replacements: Record<string, string>,
) {
  const templatePath = path.join(process.cwd(), "src", "templates", templateNames[documentType]);
  const template = await readFile(templatePath);
  const zip = new PizZip(template);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("Template surat tidak memiliki document.xml.");

  const renderedXml = documentFile.asText().replace(
    paragraphPattern,
    (paragraph) => replaceTagsInParagraph(paragraph, replacements),
  );
  const leftovers = visibleAngleTags(renderedXml);
  if (leftovers.length > 0) throw new Error(`Tag template belum terisi: ${leftovers.join(", ")}`);
  if (!visibleDocumentText(renderedXml).includes("${ttd_pengirim}")) {
    throw new Error("Penanda tanda tangan elektronik pada template tidak ditemukan.");
  }

  zip.file("word/document.xml", renderedXml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
