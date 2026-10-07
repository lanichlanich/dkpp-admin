import "server-only";

import PizZip from "pizzip";
import { DEFAULT_SIGNATORY, signatoryTitle, type Signatory } from "@/lib/signatory";
import { hukdisSanctions, type HukdisRecord } from "@/lib/hukdis-types";

type ReportEmployee = { nip: string; name: string; position: string };

const xml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const cellWidths = [500, 3500, 2200, 4500, ...Array.from({ length: 8 }, () => 1300), 2111];

function run(value: string, size = 11, bold = false) {
  const properties = `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="${size}"/>${bold ? "<w:b/>" : ""}</w:rPr>`;
  return value.split("\n").map((line, index) => `${index ? `<w:r>${properties}<w:br/></w:r>` : ""}<w:r>${properties}<w:t xml:space="preserve">${xml(line)}</w:t></w:r>`).join("");
}

function paragraph(value: string, { align = "left", size = 11, bold = false, after = 0 }: { align?: string; size?: number; bold?: boolean; after?: number } = {}) {
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="${after}" w:line="220" w:lineRule="auto"/></w:pPr>${run(value, size, bold)}</w:p>`;
}

function cell(value: string, width: number, options: { span?: number; merge?: "restart" | "continue"; align?: string; bold?: boolean; size?: number } = {}) {
  const span = options.span && options.span > 1 ? `<w:gridSpan w:val="${options.span}"/>` : "";
  const merge = options.merge ? `<w:vMerge w:val="${options.merge}"/>` : "";
  const content = options.merge === "continue" ? "" : paragraph(value, { align: options.align ?? "center", size: options.size ?? 9, bold: options.bold });
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${span}${merge}<w:vAlign w:val="center"/><w:tcMar><w:top w:w="24" w:type="dxa"/><w:start w:w="28" w:type="dxa"/><w:bottom w:w="24" w:type="dxa"/><w:end w:w="28" w:type="dxa"/></w:tcMar></w:tcPr>${content}</w:tc>`;
}

function row(cells: string[], header = false) {
  return `<w:tr>${header ? "<w:trPr><w:tblHeader w:val=\"true\"/></w:trPr>" : ""}${cells.join("")}</w:tr>`;
}

function date(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.valueOf()) ? value : new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(parsed);
}

export function generateHukdisReportDocument({
  period,
  employees,
  records,
  signatory = DEFAULT_SIGNATORY,
}: {
  period: string;
  employees: ReportEmployee[];
  records: HukdisRecord[];
  signatory?: Signatory;
}) {
  const [year, month] = period.split("-").map(Number);
  const periodLabel = new Intl.DateTimeFormat("id-ID", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  const byNip = new Map(records.map((record) => [record.employeeNip, record]));
  const sanctions = hukdisSanctions.map(({ label }) => label.replace(/\s+Selama /i, "\nSelama "));
  const widths = cellWidths;
  const headers = [
    row([
      cell("NO", widths[0], { merge: "restart", bold: true }), cell("NAMA", widths[1], { merge: "restart", bold: true }),
      cell("NIP", widths[2], { merge: "restart", bold: true }), cell("NAMA JABATAN", widths[3], { merge: "restart", bold: true }),
      cell("TINGKAT HUKUMAN DISIPLIN", widths.slice(4, 12).reduce((a, b) => a + b, 0), { span: 8, bold: true }),
      cell("NO./TGL KEPUTUSAN", widths[12], { merge: "restart", bold: true }),
    ], true),
    row([
      cell("", widths[0], { merge: "continue" }), cell("", widths[1], { merge: "continue" }), cell("", widths[2], { merge: "continue" }), cell("", widths[3], { merge: "continue" }),
      cell("RINGAN", widths[4] + widths[5], { span: 2, bold: true }), cell("SEDANG", widths[6] + widths[7] + widths[8], { span: 3, bold: true }),
      cell("BERAT", widths[9] + widths[10] + widths[11], { span: 3, bold: true }), cell("", widths[12], { merge: "continue" }),
    ], true),
    row([
      cell("", widths[0], { merge: "continue" }), cell("", widths[1], { merge: "continue" }), cell("", widths[2], { merge: "continue" }), cell("", widths[3], { merge: "continue" }),
      ...sanctions.map((label, index) => cell(`${index + 1}. ${label}`, widths[index + 4], { size: 10, bold: true })),
      cell("", widths[12], { merge: "continue" }),
    ], true),
    row([
      cell("1", widths[0], { merge: "continue" }), cell("2", widths[1], { merge: "continue" }), cell("", widths[2], { merge: "continue" }), cell("3", widths[3], { merge: "continue" }),
      ...Array.from({ length: 8 }, (_, index) => cell(String(index + 4), widths[index + 4], { merge: "continue" })),
      cell("", widths[12], { merge: "continue" }),
    ], true),
  ].join("");
  const bodyRows = employees.map((employee, index) => {
    const record = byNip.get(employee.nip);
    return row([
      cell(String(index + 1), widths[0], { size: 9 }), cell(employee.name, widths[1], { align: "left", size: 10 }),
      cell(employee.nip, widths[2], { size: 9 }), cell(employee.position, widths[3], { align: "left", size: 10 }),
      ...hukdisSanctions.map((sanction, sanctionIndex) => cell(record?.sanctionCode === sanction.code ? "✓" : "-", widths[sanctionIndex + 4], { size: 10 })),
      cell(record ? `No. ${record.decisionNumber}\n${date(record.decisionDate)}` : "", widths[12], { size: 9 }),
    ]);
  }).join("");
  const table = `<w:tbl><w:tblPr><w:tblW w:w="23211" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="000000"/><w:left w:val="single" w:sz="6" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:color="000000"/><w:right w:val="single" w:sz="6" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:color="000000"/></w:tblBorders><w:tblCellMar><w:top w:w="24" w:type="dxa"/><w:start w:w="28" w:type="dxa"/><w:bottom w:w="24" w:type="dxa"/><w:end w:w="28" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>${headers}${bodyRows}</w:tbl>`;
  const signatoryLines = signatoryTitle(signatory).replace(/^Plt\.\s*/i, "Plt. ").replace(/ DAN PERTANIAN KABUPATEN INDRAMAYU$/i, " DAN PERTANIAN\nKABUPATEN INDRAMAYU").split("\n");
  const signature = `<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="180" w:after="0"/></w:pPr>${run("Mengetahui", 12)}</w:p>${signatoryLines.map((line) => `<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="0"/></w:pPr>${run(line, 12)}</w:p>`).join("")}<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="900"/></w:pPr>${run(signatory.name, 12, true)}</w:p>${signatory.nip ? `<w:p><w:pPr><w:jc w:val="right"/></w:pPr>${run(`NIP. ${signatory.nip}`, 12)}</w:p>` : ""}`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraph("DAFTAR VALIDASI HUKUMAN DISIPLIN PEGAWAI NEGERI SIPIL", { align: "center", size: 20, bold: true, after: 0 })}${paragraph("KABUPATEN INDRAMAYU", { align: "center", size: 20, bold: true, after: 140 })}${paragraph("OPD: DINAS KETAHANAN PANGAN DAN PERTANIAN", { size: 14 })}${paragraph(`BULAN: ${periodLabel} ${year}`, { size: 14, after: 100 })}${table}${signature}<w:sectPr><w:pgSz w:w="23811" w:h="16838" w:orient="landscape"/><w:pgMar w:top="300" w:right="300" w:bottom="300" w:left="300" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const zip = new PizZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", documentXml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
