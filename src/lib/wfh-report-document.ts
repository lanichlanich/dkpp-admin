import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import type { ReportEmployee, WfhReportInput } from "@/lib/wfh-report-validation";

const paragraphs = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
const texts = /<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g;
function decode(v: string) { return v.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&"); }
function encode(v: string) { return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function visible(xml: string) { return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => decode(m[1])).join(""); }
// Replace only text nodes inside the existing runs; retain every formatting element.
function fillParagraph(xml: string, value: string) {
  let first = true;
  return xml.replace(texts, (node) => {
    const replacement = first ? encode(value) : ""; first = false;
    return node.replace(/(<w:t(?:\s[^>]*)?>)[\s\S]*?(<\/w:t>)/, (_match, open, close) => open + replacement + close);
  });
}
export async function generateWfhReport(employee: ReportEmployee, input: WfhReportInput) {
  const zip = new PizZip(await readFile(path.join(process.cwd(), "src/templates/template-wfh-report.docx")));
  const source = zip.file("word/document.xml")?.asText();
  if (!source) throw new Error("Template laporan WFH tidak tersedia.");
  const date = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${input.date}T00:00:00Z`)).replaceAll("/", "-");
  const replacements: Record<string, string> = {
    "<nama_pegawai>": employee.name, "<nip>": employee.nip,
    "<pangkat> / <golongan>": input.rank, "<jabatan>": employee.position,
    "DINAS KETAHANAN PANGAN DAN PERTANIAN": employee.unit,
  };
  for (let i = 0; i < 4; i++) { replacements[`<aktivitas${i + 1}>`] = input.tasks[i].activity; replacements[`<output${i + 1}>`] = input.tasks[i].output; }
  let xml = source.replace(paragraphs, p => {
    const value = visible(p);
    if (value.startsWith("Hari/Tangal:")) return fillParagraph(p, `Hari/Tanggal: ${date}`);
    return replacements[value] !== undefined ? fillParagraph(p, replacements[value]) : p;
  });
  let tableIndex = 0;
  xml = xml.replace(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g, table => {
    if (tableIndex++ !== 1) return table;
    let rowIndex = -1;
    return table.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g, row => {
      const i = rowIndex++;
      const rowProperties = i < 0 ? "<w:tblHeader/><w:cantSplit/>" : "<w:cantSplit/>";
      row = row.includes("<w:trPr>") ? row.replace("<w:trPr>", "<w:trPr>" + rowProperties) : row.replace(/(<w:tr\b[^>]*>)/, "$1<w:trPr>" + rowProperties + "</w:trPr>");
      if (i < 0) return row;
      const task = input.tasks[i];
      let cellIndex = 0;
      return row.replace(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g, cell => {
        const c = cellIndex++;
        if (c !== 1 && c !== 4) return cell;
        return cell.replace(paragraphs, p => fillParagraph(p, c === 1 ? `${task.start.replace(":", ".")}-${task.end.replace(":", ".")}` : `${task.status}%`));
      });
    });
  });
  if (/<(?:nama_pegawai|nip|pangkat|golongan|jabatan|aktivitas\d|output\d)>/.test(visible(xml))) throw new Error("Isian template belum lengkap.");
  // The reference ends with six empty paragraphs, which create a blank page after filling.
  xml = xml.replace(/(<\/w:tbl>)(?:<w:p\b[^>]*\/>)+(?=<w:sectPr\b)/, '$1<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>');
  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
