import "server-only";
import type PizZip from "pizzip";
import { DEFAULT_SIGNATORY, signatoryRank, signatoryTitle, type Signatory } from "@/lib/signatory";

const paragraphs = /<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g;
const textNodes = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const decode = (value: string) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const encode = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// Replace a span even when Word splits it across runs. Keep run properties,
// paragraph properties, breaks, drawings, and all other ZIP parts intact.
function replaceText(paragraph: string, needle: string, replacement: string, lineBreaks = false) {
  const values = [...paragraph.matchAll(textNodes)].map((match) => decode(match[2]));
  const start = values.join("").indexOf(needle);
  if (start < 0) return paragraph;
  const end = start + needle.length;
  let offset = 0;
  for (let index = 0; index < values.length; index++) {
    const next = offset + values[index].length;
    if (next > start && offset < end) {
      const prefix = values[index].slice(0, Math.max(0, start - offset));
      const suffix = values[index].slice(Math.max(0, end - offset));
      values[index] = prefix + (offset <= start ? replacement : "") + suffix;
    }
    offset = next;
  }
  let index = 0;
  return paragraph.replace(textNodes, (_node, attrs: string | undefined) => {
    const text = encode(values[index++]);
    return `<w:t${attrs ?? ""}>${lineBreaks ? text.replace(/\n/g, '</w:t><w:br/><w:t xml:space="preserve">') : text}</w:t>`;
  });
}

function centerParagraph(paragraph: string) {
  if (/<w:jc\b/.test(paragraph)) return paragraph.replace(/<w:jc\b[^>]*\/>/, '<w:jc w:val="center"/>');
  if (/<w:pPr>/.test(paragraph)) {
    return paragraph.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/, (_match, properties: string) => {
      const alignment = '<w:jc w:val="center"/>';
      return `<w:pPr>${properties.includes('<w:rPr>') ? properties.replace('<w:rPr>', `${alignment}<w:rPr>`) : properties + alignment}</w:pPr>`;
    });
  }
  return paragraph.replace(/(<w:p(?=[\s>])[^>]*>)/, '$1<w:pPr><w:jc w:val="center"/></w:pPr>');
}

export function applySignatoryToTemplate(zip: PizZip, signatory: Signatory, kind: "letter" | "dpcp" | "pak" = "letter") {
  const original = zip.file("word/document.xml")?.asText();
  if (!original) throw new Error("Template dokumen tidak tersedia.");
  const rank = signatoryRank(signatory.rank);
  let headingContinuation = false;
  let electronicHeading = false;
  let found = false;
  const xml = original.replace(paragraphs, (paragraph) => {
    const visible = [...paragraph.matchAll(textNodes)].map((match) => decode(match[2])).join("");
    const text = visible.trim();
    if (!text) return paragraph;
    if (/^Ditandatang\S* secara elektronik oleh\s*:/i.test(text)) {
      electronicHeading = true;
      return centerParagraph(replaceText(paragraph, visible, "Ditandatangani secara elektronik oleh:"));
    }
    if (headingContinuation && /^(?:DAN PERTANIAN(?: KABUPATEN INDRAMAYU)?|KABUPATEN INDRAMAYU)$/i.test(text)) {
      return replaceText(paragraph, visible, "");
    }
    headingContinuation = false;
    if (/^(?:Plt\.?\s*)?KEPALA DINAS KETAHANAN PANGAN/i.test(text)) {
      found = true;
      if (electronicHeading) {
        electronicHeading = false;
        const title = signatoryTitle(signatory);
        const lines = title.replace(/ DAN PERTANIAN KABUPATEN INDRAMAYU$/i, ' DAN\nPERTANIAN KABUPATEN INDRAMAYU');
        return centerParagraph(replaceText(paragraph, visible, lines, true));
      }
      // Preserve the template's separate heading lines for the same office.
      // Other selected offices replace the heading and clear its continuation.
      if (signatory.title.replace(/^Plt\.?\s*/i, "").trim().toUpperCase() === DEFAULT_SIGNATORY.title && text === text.toUpperCase()) {
        const heading = visible.replace(/^Plt\.?\s*/i, "").replace("PERTANAIN", "PERTANIAN");
        return replaceText(paragraph, visible, `${signatory.status === "plt" ? "Plt. " : ""}${heading}`);
      }
      headingContinuation = !/KABUPATEN INDRAMAYU/i.test(text);
      return replaceText(paragraph, visible, signatoryTitle(signatory));
    }
    if (kind === "pak") {
      if (text.includes("Pejabat Penilai Kinerja") && text.includes("{tanggal}")) {
        found = true;
        return replaceText(paragraph, "Pejabat Penilai Kinerja", signatoryTitle(signatory));
      }
      if (!signatory.nip && text.includes("NIP. {penilai_nip}")) return replaceText(paragraph, "NIP. {penilai_nip}", "");
      return paragraph;
    }
    if (kind === "dpcp") {
      if (text.includes("<nama_kadis>")) {
        paragraph = replaceText(paragraph, "<nama_kadis>", signatory.name);
        paragraph = replaceText(paragraph, "NIP. <nip_kadis>", signatory.nip ? `NIP. ${signatory.nip}` : "");
        paragraph = replaceText(paragraph, "<nip_kadis>", signatory.nip);
      }
      return paragraph;
    }
    if (/SUGENG\s+HERYANTO/i.test(text)) return replaceText(paragraph, visible, signatory.name);
    if (text.replace(/\D/g, "") === "196609231987091001") return replaceText(paragraph, visible, /^NIP/i.test(text) && signatory.nip ? `NIP. ${signatory.nip}` : signatory.nip);
    if (/^Pembina Utama Muda/i.test(text)) return replaceText(paragraph, visible, /IV\/c/i.test(text) ? rank.full : rank.name);
    return paragraph;
  });
  if (!found) throw new Error("Bagian jabatan penandatangan pada template tidak ditemukan.");
  zip.file("word/document.xml", xml);
}
