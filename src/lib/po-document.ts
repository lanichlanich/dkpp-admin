import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { formatKakRupiah, type KakDraft } from "@/lib/kak-types";
import type { KakOptions } from "@/lib/kak-validation";
import { terbilangRupiah } from "@/lib/kgb";
import { signatoryTitle } from "@/lib/signatory";
import { resolvePoSignatory } from "@/lib/po-signatory";
import { resolveKakSequence } from "@/lib/kak-sequence";

const text = (xml: string) => [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("");
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
function paragraph(source: string, value: string) {
  const pPr = source.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/)?.[0] || "";
  const run = [...source.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g)].find((r) => /<w:t(?:\s|>)/.test(r[0]))?.[0] || "";
  const rPr = run.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/)?.[0] || "";
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escape(value.replace(/\r?\n/g, " "))}</w:t></w:r></w:p>`;
}
function fillCell(cell: string, value: string) {
  const properties = cell.match(/<w:tcPr\b[^>]*>[\s\S]*?<\/w:tcPr>/)?.[0] || "";
  const first = cell.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/)?.[0];
  if (!first) throw new Error("Sel template PO tidak sesuai.");
  return `<w:tc>${properties}${paragraph(first, value)}</w:tc>`;
}
function fillCostRow(row: string, label: string, amount: string) {
  let index = 0;
  return row.replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, (cell) => {
    const current = index++;
    return current === 0 ? fillCell(cell, label) : current === 2 ? fillCell(cell, amount) : cell;
  });
}
const withoutCode = (value: string) => value.replace(/^\s*\.?\d+(?:\.\d+)*\s+/, "").trim();
function budgetWords(value: string) {
  const [whole, cents = ""] = value.split(".");
  const fraction = Number(cents.padEnd(2, "0"));
  const words = `${terbilangRupiah(Number(whole))}${fraction ? ` ${terbilangRupiah(fraction).replace(/ rupiah$/, " sen")}` : ""}`;
  return `${formatKakRupiah(value)} (${words.replace(/\b[a-z]/g, (v) => v.toUpperCase())})`;
}
export function getPoWarnings(draft: KakDraft, options: KakOptions) {
  const m = draft.metadata;
  const warnings: string[] = [];
  if (!m.hasil) warnings.push("Indikator hasil PO tidak tercantum atau belum terbaca pada RKA; lengkapi pada dokumen sebelum digunakan.");
  if (!options.poSistemPengadaan && !m.sistemPengadaan) warnings.push("Sistem pengadaan PO belum ditetapkan; pilih pada form atau lengkapi pada dokumen.");
  if (!m.rincianRekening?.length) warnings.push("Rekening belanja PO belum terbaca; tabel biaya memakai rincian item RKA. Cocokkan dengan kode rekening sumber.");
  if (!(options.poSignatory ?? resolvePoSignatory(m, options, [])).rank) warnings.push("Pangkat penandatangan PO belum terisi; pilih pejabat pada form atau lengkapi pada dokumen.");
  return warnings;
}

export async function generatePoDocument(draft: KakDraft, options: KakOptions) {
  const source = await readFile(path.join(process.cwd(), "src/templates/template-po.docx"));
  const zip = new PizZip(source);
  let xml = zip.file("word/document.xml")!.asText();
  if ((xml.match(/<w:tbl(?:\s[^>]*)?>/g) || []).length !== 4) throw new Error("Struktur template PO berubah.");
  const m = draft.metadata;
  const signer = options.poSignatory ?? resolvePoSignatory(m, options, []);
  const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${options.tanggalDokumen}T00:00:00+07:00`));
  const values: Record<string, string> = {
    program: withoutCode(m.program), activity: withoutCode(m.kegiatan), subActivity: [m.kodeSubKegiatan, withoutCode(m.subKegiatan)].filter(Boolean).join("  "),
    budget: formatKakRupiah(m.paguAnggaran), budgetWords: budgetWords(m.paguAnggaran), year: `TAHUN ANGGARAN ${m.tahunAnggaran}`,
    organization: withoutCode(m.perangkatDaerah).toLocaleUpperCase("id-ID"), description: draft.sections.gambaranUmum,
    location: m.lokasi || "[Lokasi perlu dilengkapi]", time: `${m.waktuPelaksanaan || "[Waktu perlu dilengkapi]"}, Tahun Anggaran ${m.tahunAnggaran}`,
    funding: m.sumberDana || "[Sumber dana perlu dilengkapi]", output: `${m.keluaran || "[Keluaran perlu dilengkapi]"}${m.targetKeluaran ? ` (${m.targetKeluaran})` : ""}`,
    outcome: `${m.hasil || "[Indikator hasil perlu dilengkapi]"}${m.targetHasil ? ` (${m.targetHasil})` : ""}`,
    procurement: options.poSistemPengadaan || m.sistemPengadaan || "[Sistem pengadaan perlu ditetapkan]", date: `Indramayu, ${date}`,
    signerTitle: signer.title ? signatoryTitle(signer) : "[Jabatan penandatangan perlu dilengkapi]",
    signerName: signer.name || "[Nama penandatangan perlu dilengkapi]",
    signerRank: signer.rank || "[Pangkat perlu dilengkapi]", signerNip: `NIP. ${signer.nip || "[Perlu dilengkapi]"}`,
  };
  const costs = m.rincianRekening?.length ? m.rincianRekening.map((item) => ({ label: `${item.kode} ${item.uraian}`.trim(), amount: formatKakRupiah(item.jumlah) }))
    : m.rincianAnggaran.map((item) => ({ label: `${item.uraian}${item.volume ? ` (${item.volume})` : ""}`, amount: formatKakRupiah(item.jumlah) }));
  if (!costs.length) costs.push({ label: "[Rincian biaya perlu dilengkapi sesuai RKA]", amount: "[Perlu dilengkapi]" });
  let tableIndex = 0;
  xml = xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, (table) => {
    if (tableIndex++ !== 3) return table;
    const rows = table.match(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g) || [];
    if (rows.length !== 12) throw new Error("Tabel biaya template PO berubah.");
    let rowIndex = 0;
    return table.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, (row) => {
      const current = rowIndex++;
      if (current === 0 || current === rows.length - 1) return row;
      return current === 1 ? costs.map((item) => fillCostRow(row, item.label, item.amount)).join("") : "";
    });
  });
  const filled = new Set<string>();
  xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (p) => {
    const key = text(p).match(/^\$\{po\.([A-Za-z]+)\}$/)?.[1];
    if (!key) return p;
    if (!(key in values)) throw new Error(`Tag PO tidak dikenal: ${key}`);
    filled.add(key);
    return paragraph(p, values[key]);
  });
  if (Object.keys(values).some((key) => !filled.has(key)) || /\$\{po\./.test(text(xml))) throw new Error("Isian template PO tidak lengkap.");
  const sequence = await resolveKakSequence(m, options.nomorUrutSubKegiatan);
  const relationships = zip.file("word/_rels/document.xml.rels")?.asText();
  const contentTypes = zip.file("[Content_Types].xml")?.asText();
  if ((xml.match(/<w:sectPr\b/g) || []).length !== 1 || /<w:headerReference\b|<w:titlePg\b/.test(xml) || !relationships?.includes("</Relationships>") || relationships.includes('Id="rIdPoCoverSequence"') || !contentTypes?.includes("</Types>")) {
    throw new Error("Struktur header cover PO berubah.");
  }
  // A first-page header keeps the sequence on the cover without moving the body.
  xml = xml.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/, (section) => section
    .replace(/(<w:sectPr\b[^>]*>)/, '$1<w:headerReference w:type="first" r:id="rIdPoCoverSequence"/>')
    .replace(/<w:docGrid\b|<\/w:sectPr>/, (tag) => `<w:titlePg/>${tag}`));
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escape(sequence.number)}</w:t></w:r></w:p></w:hdr>`;
  zip.file("word/header-po-cover.xml", header);
  zip.file("word/_rels/document.xml.rels", relationships.replace("</Relationships>", '<Relationship Id="rIdPoCoverSequence" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header-po-cover.xml"/></Relationships>'));
  zip.file("[Content_Types].xml", contentTypes.replace("</Types>", '<Override PartName="/word/header-po-cover.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>'));
  zip.file("word/document.xml", xml);
  return { document: zip.generate({ type: "nodebuffer", compression: "DEFLATE" }), templateSha256: createHash("sha256").update(source).digest("hex") };
}
