import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { KAK_SECTIONS, type KakDraft } from "@/lib/kak-types";
import type { KakOptions } from "@/lib/kak-validation";
import { signatoryTitle } from "@/lib/signatory";

const escapeXml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
function visibleText(xml: string) {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join("")
    .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&amp;", "&");
}
function paragraph(source: string, value: string, forceArial = false) {
  const properties = source.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  let runProperties = source.match(/<w:rPr[\s\S]*?<\/w:rPr>/)?.[0] ?? '<w:rPr><w:sz w:val="24"/></w:rPr>';
  if (forceArial) runProperties = runProperties.replace(/<w:rFonts\b[^>]*\/>/g, "").replace("<w:rPr>", '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>');
  const runs = value.split("\t").map((part) => `<w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`).join("<w:r><w:tab/></w:r>");
  return `<w:p>${properties}${runs}</w:p>`;
}
function fillCell(cell: string, value: string, forceArial = true) {
  const properties = cell.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/)?.[0] ?? "";
  const source = cell.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/)?.[0] ?? "";
  return `<w:tc>${properties}${value.split(/\r?\n/).filter(Boolean).map((line) => paragraph(source, line, forceArial)).join("") || paragraph(source, "", forceArial)}</w:tc>`;
}

/** Fill only the supplied template's data cells; all other ZIP parts remain byte-identical. */
export async function generateKakDocument(draft: KakDraft, options: KakOptions) {
  const zip = new PizZip(await readFile(path.join(process.cwd(), "src", "templates", "template-kak.docx")));
  let xml = zip.file("word/document.xml")!.asText();
  const tables = xml.match(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g);
  if (tables?.length !== 6) throw new Error("Struktur template KAK berubah.");
  const m = draft.metadata;
  const metadata = [m.perangkatDaerah, m.urusanPemerintahan, m.bidangUrusan, m.program, m.kegiatan, `${m.kodeSubKegiatan} ${m.subKegiatan}`.trim()];
  let tableIndex = 0;
  let slotIndex = 0;
  xml = xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, (table) => {
    const currentTable = tableIndex++;
    if (currentTable === 5) table = table.replace('<w:gridCol w:w="2441"/>', '<w:gridCol w:w="2201"/>').replace('<w:gridCol w:w="1430"/>', '<w:gridCol w:w="1670"/>');
    let rowIndex = 0;
    return table.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, (row) => {
      const currentRow = rowIndex++;
      // These rows only continued authoring instructions from a previous cell.
      if ((currentTable === 2 || currentTable === 3) && currentRow === 0) return "";
      const editable = /<generate\s+(?:dengan\s+)?ai>/i.test(visibleText(row)) || (currentTable === 5 && currentRow >= 3 && currentRow <= 5);
      if (editable) row = row.replace(/<w:trHeight\b[^>]*\/>/g, '<w:trHeight w:val="414" w:hRule="atLeast"/>');
      if (currentTable === 5 && currentRow >= 2 && currentRow <= 5) row = row.replace("<w:trPr>", "<w:trPr><w:cantSplit/>");
      if (currentTable > 0 && !editable && visibleText(row).trim()) row = row.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (p) =>
        p.includes("<w:keepNext") ? p : p.includes("<w:pPr>") ? p.replace("<w:pPr>", "<w:pPr><w:keepNext/>") : p.replace(/<w:p(?:\s[^>]*)?>/, "<w:p><w:pPr><w:keepNext/></w:pPr>"));
      let cellIndex = 0;
      return row.replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, (cell) => {
        const currentCell = cellIndex++;
        if (currentTable === 5 && currentRow >= 2 && currentRow <= 5) {
          if (currentCell === 4) cell = cell.replace('w:w="2441"', 'w:w="2201"');
          if (currentCell === 5) cell = cell.replace('w:w="1430"', 'w:w="1670"');
        }
        if (currentTable === 0 && currentCell === 2) return fillCell(cell, metadata[currentRow] || "[Perlu dilengkapi]");
        if ((currentTable === 2 || currentTable === 3) && currentRow === 0 && currentCell === 2) return fillCell(cell, "");
        if (/<generate\s+(?:dengan\s+)?ai>/i.test(visibleText(cell))) {
          const section = KAK_SECTIONS[slotIndex++];
          if (!section) throw new Error("Jumlah tag template KAK tidak sesuai.");
          return fillCell(cell, draft.sections[section[0]]);
        }
        if (currentTable === 5 && currentRow >= 3 && currentRow <= 5 && currentCell >= 3 && currentCell <= 7) {
          const risk = draft.risks[currentRow - 3];
          const value = [String(currentRow - 2), m.subKegiatan, risk.risiko, risk.penyebab, risk.mitigasi][currentCell - 3]
            .replace(/pertanggungjawaban/gi, (word) => `${word.slice(0, 11)}\u00ad${word.slice(11)}`)
            .replace(/ketidaksesuaian/gi, (word) => `${word.slice(0, 7)}\u00ad${word.slice(7)}`);
          return fillCell(cell, value, false);
        }
        return cell;
      });
    });
  });
  if (slotIndex !== KAK_SECTIONS.length) throw new Error("Tag pengisian template KAK tidak lengkap.");
  const signerName = options.signatory?.name || m.penandatanganNama || "[Nama PA/KPA]";
  const signerNip = options.signatory?.nip ?? m.penandatanganNip;
  const signerRole = options.signatory ? signatoryTitle(options.signatory) : (m.penandatanganJabatan || "PA / KPA");
  const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${options.tanggalDokumen}T00:00:00+07:00`));
  // Keep the template's two signature columns while allowing long office titles
  // to wrap inside their own column instead of running through the PPTK title.
  const signatureCell = (value: string, kind: "title" | "name" | "nip") => `<w:tc><w:tcPr><w:tcW w:w="4700" w:type="dxa"/></w:tcPr>${paragraph(`<w:p><w:pPr>${kind !== "nip" ? "<w:keepNext/>" : ""}<w:spacing w:after="${kind === "title" ? 900 : 0}"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr>${kind === "name" ? "<w:b/>" : ""}<w:sz w:val="24"/></w:rPr></w:r></w:p>`, value, true)}</w:tc>`;
  const signatureRows = [[signerRole, "Penanggung Jawab/PPTK", "title"], [signerName, options.pptkNama || "[Nama PPTK]", "name"], [`NIP. ${signerNip || "[Perlu dilengkapi]"}`, `NIP. ${options.pptkNip || "[Perlu dilengkapi]"}`, "nip"]] as const;
  const signatureTable = `<w:tbl><w:tblPr><w:tblW w:w="9400" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((edge) => `<w:${edge} w:val="nil"/>`).join("")}</w:tblBorders><w:tblCellMar><w:left w:w="250" w:type="dxa"/><w:right w:w="250" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="4700"/><w:gridCol w:w="4700"/></w:tblGrid>${signatureRows.map(([left, right, kind]) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${signatureCell(left, kind)}${signatureCell(right, kind)}</w:tr>`).join("")}</w:tbl><w:p/>`;
  let signatureStarted = false;
  let signatureEnded = false;
  let signatureDateStarted = false;
  const keepWithNext = (p: string) => p.includes("<w:pPr>") ? p.replace("<w:pPr>", "<w:pPr><w:keepNext/>") : p.replace(/<w:p(?:\s[^>]*)?>/, "<w:p><w:pPr><w:keepNext/></w:pPr>");
  xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (p) => {
    const value = visibleText(p);
    if (value.includes("<nama_sub_kegiatan>")) return paragraph(p, `Rencana Sub Kegiatan ${m.subKegiatan}`);
    if (/^Tahun Anggaran\s+2027\s*$/.test(value)) return paragraph(p, `Tahun Anggaran ${m.tahunAnggaran}`);
    if (value.startsWith("Indramayu,")) { signatureDateStarted = true; return keepWithNext(paragraph(p, `Indramayu, ${date}`)); }
    if (value.includes("PA / KPA") && value.includes("PPTK")) { signatureStarted = true; return signatureTable; }
    if (signatureStarted && !signatureEnded) {
      if (value.startsWith("NIP")) signatureEnded = true;
      return "";
    }
    if (signatureDateStarted && !signatureStarted) return keepWithNext(p);
    return p;
  });
  if (!signatureEnded) throw new Error("Blok penandatangan template KAK tidak ditemukan.");
  if (/<generate\s+(?:dengan\s+)?ai>|<nama_sub_kegiatan>/i.test(visibleText(xml))) throw new Error("Masih ada tag kosong dalam draft KAK.");
  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
