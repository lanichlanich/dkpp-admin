import { applySignatoryToTemplate } from "@/lib/signatory-document";
import { DEFAULT_SIGNATORY, type Signatory } from "@/lib/signatory";
import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";

export type KerjakuEmployee = { nip: string; name: string; position: string };

const paragraphPattern = /<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g;
const textPattern = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;

function decode(value: string) {
  return value.replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function encode(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// The template splits some placeholders across Word runs. Change their text while
// retaining the original paragraph, run formatting, header, and TTE marker.
function replaceParagraph(paragraph: string, replacements: Record<string, string>) {
  const matches = [...paragraph.matchAll(textPattern)];
  const texts = matches.map((match) => decode(match[2]));
  for (const [needle, replacement] of Object.entries(replacements)) {
    let joined = texts.join("");
    let start = joined.indexOf(needle);
    while (start !== -1) {
      const end = start + needle.length;
      let cursor = 0;
      let first = -1;
      let last = -1;
      let from = 0;
      let to = 0;
      for (let index = 0; index < texts.length; index++) {
        const next = cursor + texts[index].length;
        if (first === -1 && start >= cursor && start < next) { first = index; from = start - cursor; }
        if (end > cursor && end <= next) { last = index; to = end - cursor; break; }
        cursor = next;
      }
      if (first < 0 || last < 0) throw new Error(`Tag template tidak valid: ${needle}`);
      if (first === last) texts[first] = texts[first].slice(0, from) + replacement + texts[first].slice(to);
      else {
        texts[first] = texts[first].slice(0, from) + replacement;
        for (let index = first + 1; index < last; index++) texts[index] = "";
        texts[last] = texts[last].slice(to);
      }
      joined = texts.join("");
      start = joined.indexOf(needle);
    }
  }
  let index = 0;
  return paragraph.replace(textPattern, (_match, attrs: string | undefined) =>
    `<w:t${attrs ?? ""}>${encode(texts[index++])}</w:t>`);
}

function visibleText(xml: string) {
  return [...xml.matchAll(textPattern)].map((match) => decode(match[2])).join("");
}

export async function generatePembukaanKerjakuDocument(input: {
  tanggalSurat: string;
  nomorSurat: string;
  bulanDibuka: string;
  employees: KerjakuEmployee[];
  signatory?: Signatory;
}) {
  const template = await readFile(path.join(process.cwd(), "src", "templates", "template-pembukaan-kerjaku.docx"));
  const zip = new PizZip(template);
  applySignatoryToTemplate(zip, input.signatory ?? DEFAULT_SIGNATORY);
  const original = zip.file("word/document.xml")?.asText();
  if (!original) throw new Error("Template Kerjaku tidak memiliki document.xml.");

  const [year, month] = input.bulanDibuka.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("id-ID", { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
  const monthYear = `${monthName} ${year}`;
  const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${input.tanggalSurat}T00:00:00Z`));
  let xml = original.replace(paragraphPattern, (paragraph) => replaceParagraph(paragraph, {
    "<tgl_surat>": date,
    "800.1.5/<No._surat>-Sekret": input.nomorSurat,
    "<bulan> 2026": monthYear,
  }));

  const table = xml.match(/<w:tbl(?=[\s>])[^>]*>[\s\S]*?<\/w:tbl>/)?.[0];
  if (!table) throw new Error("Tabel lampiran pegawai tidak ditemukan.");
  const rows = [...table.matchAll(/<w:tr(?=[\s>])[^>]*>[\s\S]*?<\/w:tr>/g)].map((match) => match[0]);
  if (rows.length !== 6) throw new Error("Struktur tabel template Kerjaku berubah.");
  const prototype = rows[5];
  const employeeRows = input.employees.map((employee, index) => {
    let row = prototype.replace(/(<w:t(?:\s[^>]*)?>)5\.(<\/w:t>)/, (_match, open: string, close: string) => `${open}${index + 1}.${close}`);
    row = row.replace(paragraphPattern, (paragraph) => replaceParagraph(paragraph, {
      "<nama_pegawai>": employee.name,
      "<nip>": employee.nip,
      "<jabatan>": employee.position,
    }));
    return row;
  });
  const firstRow = table.indexOf(rows[0]);
  const lastRowEnd = table.lastIndexOf(rows[5]) + rows[5].length;
  xml = xml.replace(table, table.slice(0, firstRow) + rows[0] + employeeRows.join("") + table.slice(lastRowEnd));
  if (/<(?:tgl_surat|No\._surat|bulan|nama_pegawai|nip|jabatan)>/.test(visibleText(xml)))
    throw new Error("Tag template Kerjaku belum terisi.");
  if (!visibleText(xml).includes("${ttd_pengirim}")) throw new Error("Penanda TTE tidak ditemukan.");
  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
