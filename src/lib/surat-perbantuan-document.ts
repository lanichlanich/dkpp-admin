import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { formatIndonesianDate } from "@/lib/kgb";
import { perbantuanRank, type SuratPerbantuanEmployee, type SuratPerbantuanInput } from "@/lib/surat-perbantuan-validation";

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

// Word can split a single tag across runs. Replace its text while retaining every run's formatting.
function replaceParagraph(paragraph: string, replacements: Record<string, string>) {
  const matches = [...paragraph.matchAll(textPattern)];
  const texts = matches.map((match) => decodeXml(match[2]));
  const tags = [...texts.join("").matchAll(/<([^<>]{1,120})>/g)];
  if (!tags.length) return paragraph;
  for (const tag of tags.reverse()) {
    const replacement = replacements[tag[1]];
    if (replacement === undefined) throw new Error(`Tag template tidak dikenali: ${tag[0]}`);
    const start = tag.index!;
    const end = start + tag[0].length;
    let cursor = 0;
    for (let index = 0; index < texts.length; index++) {
      const next = cursor + texts[index].length;
      if (cursor < end && next > start) {
        const left = Math.max(0, start - cursor);
        const right = Math.min(texts[index].length, end - cursor);
        texts[index] = texts[index].slice(0, left) + (cursor <= start ? replacement : "") + texts[index].slice(right);
      }
      cursor = next;
    }
  }
  let index = 0;
  return paragraph.replace(textPattern, (original, attributes: string | undefined, text: string) => {
    const value = texts[index++];
    return value === decodeXml(text) ? original : `<w:t${attributes ?? ""}>${encodeXml(value)}</w:t>`;
  });
}

function removeTrailingEmptyParagraphs(xml: string) {
  const sectionStart = xml.lastIndexOf("<w:sectPr");
  if (sectionStart < 0) return xml;
  let body = xml.slice(0, sectionStart);
  // The source ends in four spacer paragraphs. Longer tag values can push only
  // those spacers onto an otherwise blank extra page; keep all actual content.
  for (;;) {
    const last = [...body.matchAll(paragraphPattern)].at(-1);
    if (!last || body.slice(last.index! + last[0].length).trim()
      || /<w:(?:t|br|tab|drawing|pict|object|fldChar|instrText|bookmarkStart|commentRangeStart|sectPr|pageBreakBefore)\b/.test(last[0])) break;
    body = body.slice(0, last.index!);
  }
  return body + xml.slice(sectionStart);
}

function keepTembusanTogether(xml: string) {
  const paragraphs = [...xml.matchAll(paragraphPattern)];
  const textOf = (paragraph: string) => [...paragraph.matchAll(textPattern)].map((match) => decodeXml(match[2])).join("").trim();
  const start = paragraphs.findIndex((paragraph) => /^Tembusan\s*:/.test(textOf(paragraph[0])));
  if (start < 0) return xml;
  const group = paragraphs.slice(start).filter((paragraph) => /^(?:Tembusan\s*:|Yth\.)/.test(textOf(paragraph[0])));
  const keepWithNext = new Set(group.slice(0, -1).map((paragraph) => paragraph.index));
  return xml.replace(paragraphPattern, (paragraph, offset: number) => {
    if (!keepWithNext.has(offset) || /<w:keepNext\b/.test(paragraph)) return paragraph;
    return paragraph.includes("<w:pPr>")
      ? paragraph.replace("<w:pPr>", "<w:pPr><w:keepNext/>")
      : paragraph.replace(/^(<w:p[^>]*>)/, "$1<w:pPr><w:keepNext/></w:pPr>");
  });
}

export async function generateSuratPerbantuanDocument(input: {
  employee: SuratPerbantuanEmployee;
  values: SuratPerbantuanInput;
}) {
  const template = await readFile(path.join(process.cwd(), "src", "templates", "template-surat-perbantuan.docx"));
  const zip = new PizZip(template);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Template surat perbantuan tidak memiliki document.xml.");
  const { pangkat, golongan } = perbantuanRank(input.employee.rank);
  const replacements: Record<string, string> = {
    no_surat: input.values.nomorSurat,
    "nama pegawai": input.employee.name,
    nip: input.employee.nip,
    pangkat,
    golongan,
    jabatan: input.employee.position || "-",
    "unit kerja": input.employee.unit || "-",
    unit_kerja: input.employee.unit || "-",
    jabatan_perbantuan: input.values.jabatanPerbantuan,
    unit_kerja_perbantuan: input.values.unitKerjaPerbantuan,
    tgl_surat: formatIndonesianDate(input.values.tanggalSurat),
  };
  if (Object.values(replacements).some((value) => !value || /[<>\x00-\x1f]/.test(value))) {
    throw new Error("Data surat tidak lengkap atau mengandung karakter yang tidak didukung.");
  }
  const xml = keepTembusanTogether(removeTrailingEmptyParagraphs(
    file.asText().replace(paragraphPattern, (paragraph) => replaceParagraph(paragraph, replacements)),
  ));
  const text = [...xml.matchAll(textPattern)].map((match) => decodeXml(match[2])).join("");
  if (/<[^<>]{1,120}>/.test(text)) throw new Error("Sebagian tag template belum terisi.");
  for (const value of Object.values(replacements)) {
    if (!text.includes(value)) throw new Error("Sebagian data surat tidak ditemukan di dokumen.");
  }
  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
