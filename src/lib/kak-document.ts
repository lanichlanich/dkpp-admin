import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { formatKakRupiah, KAK_SECTIONS, type KakDraft, type KakSectionKey } from "@/lib/kak-types";
import type { KakOptions } from "@/lib/kak-validation";
import { resolveKakSequence } from "@/lib/kak-sequence";

const escapeXml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const paragraphsOf = (xml: string) => xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [];
function visibleText(xml: string) {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join("")
    .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&amp;", "&");
}
function paragraph(source: string, value: string) {
  const properties = source.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  // Use actual text-run formatting; paragraph-mark properties may name a different font.
  const textRun = [...source.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g)].find((match) => /<w:t(?:\s|>)/.test(match[0]))?.[0] || "";
  const runProperties = textRun.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/)?.[0] ?? '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/></w:rPr>';
  const runs = value.split("\t").map((part) => `<w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`).join("<w:r><w:tab/></w:r>");
  return `<w:p>${properties}${runs}</w:p>`;
}
function withoutNumbering(source: string) {
  return source.replace(/<w:numPr\b[^>]*>[\s\S]*?<\/w:numPr>/g, "")
    .replace(/<w:ind\b[^>]*\/>/g, '<w:ind w:left="108" w:right="101"/>');
}
function fillCell(cell: string, value: string, section?: KakSectionKey) {
  const properties = cell.match(/<w:tcPr\b[^>]*>[\s\S]*?<\/w:tcPr>/)?.[0] ?? "";
  const prototypes = paragraphsOf(cell);
  const first = prototypes[0] || "";
  const listSection = section === "dasarHukum" || section === "tahapanPelaksanaan" || section === "totalBiaya";
  const numbered = prototypes.find((p) => /<w:numPr\b/.test(p));
  const plain = /<w:numPr\b/.test(first) ? withoutNumbering(first) : first;
  // Emit native Word lists with source indents and no duplicate literal numbers.
  const lines = (listSection ? value.replace(/\s+(?=\d{1,2}\.\s)/g, "\n") : value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const content = lines.map((line) => {
    const item = listSection && /^\d{1,2}[.)]\s+/.test(line);
    return paragraph(item && numbered ? numbered : plain, item && numbered ? line.replace(/^\d{1,2}[.)]\s+/, "") : line);
  }).join("") || paragraph(plain, "");
  const trailingBlank = prototypes.filter((p) => !visibleText(p).trim()).join("");
  return `<w:tc>${properties}${content}${trailingBlank}</w:tc>`;
}
const withoutLeadingCode = (value: string) => value.replace(/^\s*\.?\d+(?:\.\d+)*\s+/, "").trim();

/** Fill the supplied layout on F4 paper, preserving styles, margins and opaque ZIP parts. */
export async function generateKakDocument(draft: KakDraft, options: KakOptions) {
  const zip = new PizZip(await readFile(path.join(process.cwd(), "src", "templates", "template-kak.docx")));
  let xml = zip.file("word/document.xml")!.asText();
  if ((xml.match(/<w:tbl(?:\s[^>]*)?>/g) || []).length !== 7) throw new Error("Struktur template KAK berubah.");
  let sectionIndex = 0;
  xml = xml.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g, (section) => {
    const currentSection = sectionIndex++;
    // F4 210 x 330 mm, rounded to Word twips; apply to the cover and every body section.
    const resized = section.replace(/<w:pgSz\b[^>]*\/>/, '<w:pgSz w:w="11906" w:h="18709"/>');
    // Equal paper sizes require an explicit page break before the first body section.
    return currentSection === 1 ? resized.replace(/<w:type\b[^>]*\/>/, '<w:type w:val="nextPage"/>') : resized;
  });
  if (sectionIndex !== 5) throw new Error("Section template KAK tidak sesuai.");
  // Keep the cover logo centered when its original Letter width becomes F4.
  xml = xml.replace(/<wp:positionH\b[^>]*relativeFrom="column"[^>]*>[\s\S]*?<\/wp:positionH>/, '<wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH>');
  const m = draft.metadata;
  const metadata = [m.perangkatDaerah, m.urusanPemerintahan, m.bidangUrusan, m.program, m.kegiatan, m.subKegiatan].map(withoutLeadingCode);
  const cover = [withoutLeadingCode(m.program), withoutLeadingCode(m.kegiatan), withoutLeadingCode(m.subKegiatan), formatKakRupiah(m.paguAnggaran), m.lokasi];
  const signerName = options.signatory?.name || m.penandatanganNama || "[Nama PA/KPA]";
  const signerNip = options.signatory?.nip ?? m.penandatanganNip;
  const signatures = [[signerName, options.pptkNama || "[Nama PPTK]"], [`NIP. ${signerNip || "[Perlu dilengkapi]"}`, `NIP. ${options.pptkNip || "[Perlu dilengkapi]"}`]];
  const filled = new Set<KakSectionKey>();
  let tableIndex = 0;
  xml = xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, (table) => {
    const currentTable = tableIndex++ - 1;
    let rowIndex = 0;
    return table.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, (row) => {
      const currentRow = rowIndex++;
      let cellIndex = 0;
      return row.replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, (cell) => {
        const currentCell = cellIndex++;
        if (currentTable === -1 && currentCell === 2) return fillCell(cell, cover[currentRow] || "[Perlu dilengkapi]");
        if (currentTable === 0 && currentCell === 2) return fillCell(cell, metadata[currentRow] || "[Perlu dilengkapi]");
        const slot = visibleText(cell).match(/<generate ai:([A-Za-z]+)>/)?.[1];
        if (slot) {
          const key = KAK_SECTIONS.find(([name]) => name === slot)?.[0];
          if (!key || filled.has(key)) throw new Error("Slot template KAK tidak sesuai.");
          filled.add(key);
          return fillCell(cell, draft.sections[key], key);
        }
        if (currentTable === 4 && currentRow >= 3 && currentRow <= 5 && currentCell >= 3 && currentCell <= 7) {
          const risk = draft.risks[currentRow - 3];
          const value = [String(currentRow - 2), m.subKegiatan, risk.risiko, risk.penyebab, risk.mitigasi][currentCell - 3]
            .replace(/pertanggungjawaban/gi, (word) => `${word.slice(0, 11)}\u00ad${word.slice(11)}`)
            .replace(/ketidaksesuaian/gi, (word) => `${word.slice(0, 7)}\u00ad${word.slice(7)}`);
          return fillCell(cell, value);
        }
        if (currentTable === 5 && currentRow >= 1 && currentRow <= 2 && currentCell <= 1) return fillCell(cell, signatures[currentRow - 1][currentCell]);
        return cell;
      });
    });
  });
  if (filled.size !== KAK_SECTIONS.length) throw new Error("Tag pengisian template KAK tidak lengkap.");
  const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${options.tanggalDokumen}T00:00:00+07:00`));
  xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (p) => {
    const value = visibleText(p);
    if (value === "${kak.title}") return paragraph(p, `Rencana Sub Kegiatan ${m.subKegiatan}`);
    if (value === "${kak.year}") return paragraph(p, `Tahun Anggaran ${m.tahunAnggaran}`);
    if (value === "${kak.cover.year}") return paragraph(p, `TAHUN ANGGARAN ${m.tahunAnggaran}`);
    if (value.trim() === "${kak.date}") return paragraph(p, value.replace("${kak.date}", `Indramayu, ${date}`));
    return p;
  });
  if (/<generate ai:[^>]+>|\$\{kak\.[^}]+\}/.test(visibleText(xml))) throw new Error("Masih ada tag kosong dalam draft KAK.");
  zip.file("word/document.xml", xml);
  const header = zip.file("word/header-kak-cover.xml")?.asText();
  if (!header || visibleText(header) !== "${kak.cover.sequence}") throw new Error("Header cover KAK tidak sesuai.");
  const sequence = await resolveKakSequence(m, options.nomorUrutSubKegiatan);
  zip.file("word/header-kak-cover.xml", header.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/, (p) => paragraph(p, sequence.number)));
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
