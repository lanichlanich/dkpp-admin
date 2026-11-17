import "server-only";
import PDFDocument from "pdfkit";
import PizZip from "pizzip";
import { PROFILE_ORGANIZATION, type ReportBlock, type StaffProfileReport } from "@/lib/staff-profile";

const title = "PROFIL KEPEGAWAIAN DINAS";
const scope = "Struktur organisasi, komposisi pegawai, kebutuhan jabatan, proyeksi pensiun, dan administrasi kepegawaian";
const emptyRows = (block: Extract<ReportBlock, { type: "table" }>) => block.rows.length ? block.rows
  : [["Tidak ada data dalam cakupan ini", ...block.columns.slice(1).map(() => "-")]];

export async function createStaffProfilePdf(report: StaffProfileReport): Promise<Buffer> {
  const pdf = new PDFDocument({ size: "A4", margin: 0, bufferPages: true,
    info: { Title: title, Author: PROFILE_ORGANIZATION, Subject: `Data per ${report.dateLabel}` } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk)); pdf.on("end", () => resolve(Buffer.concat(chunks))); pdf.on("error", reject);
  });
  const margin = 56, padding = 5;
  let y = margin, landscape = false;
  const width = () => pdf.page.width - margin * 2;
  const bottom = () => pdf.page.height - margin;
  const page = (wide = landscape) => { landscape = wide; pdf.addPage({ size: "A4", layout: wide ? "landscape" : "portrait", margin: 0 }); y = margin; };
  const write = (value: string, size = 11, bold = false, align: "left" | "center" | "justify" = "justify", after = 10) => {
    pdf.font(bold ? "Times-Bold" : "Times-Roman").fontSize(size);
    const options = { width: width(), align, lineGap: 2 };
    const height = pdf.heightOfString(value, options);
    if (y + height > bottom()) page();
    pdf.text(value, margin, y, options); y += height + after;
  };
  y = 145;
  write(title, 17, true, "center", 20);
  write(PROFILE_ORGANIZATION.toUpperCase(), 14, true, "center", 30);
  write(`KEADAAN PER ${report.dateLabel.toUpperCase()}`, 12, false, "center", 12);
  write(`PROYEKSI PENSIUN TAHUN ${report.startYear} SAMPAI DENGAN ${report.endYear}`, 12, false, "center", 70);
  write(scope, 12, false, "center", 25);
  write(`Profil ini menyajikan ${report.summary.active} pegawai aktif dan pembanding kebutuhan ${report.summary.required} pegawai berdasarkan peta jabatan. Laporan beserta tiga lampirannya digunakan sebagai bahan pemutakhiran data dan perencanaan kepegawaian dinas.`, 11.5);
  y = 690; write(`KABUPATEN INDRAMAYU\n${report.today.slice(0, 4)}`, 12, true, "center");
  page(false); write("DAFTAR ISI", 13, true, "center", 26);
  for (const section of report.sections) write(`${section.title}\n${section.subtitle}`, 11.5, false, "left", 12);
  write("Data mencerminkan keadaan saat dokumen diunduh. Periode proyeksi tidak mengubah tanggal keadaan data.", 10.5, false, "left");

  for (const section of report.sections) {
    page(!!section.landscape);
    pdf.outline.addItem(`${section.title} ${section.subtitle}`);
    write(section.title, 12, true, "center", 4); write(section.subtitle.toUpperCase(), 12, true, "center", 20);
    for (const block of section.blocks) {
      if (block.type === "heading") {
        if (y + 70 > bottom()) page();
        write(block.text, 11.5, true, "left", 9);
      } else if (block.type === "paragraph") write(block.text);
      else if (block.type === "table") {
        const fontSize = landscape ? 9.5 : 10;
        const weights = block.columns.reduce((n, col) => n + col.weight, 0);
        const widths = block.columns.map(col => width() * col.weight / weights);
        const cellHeight = (values: string[], bold: boolean, indent = 0) => {
          pdf.font(bold ? "Times-Bold" : "Times-Roman").fontSize(fontSize);
          return Math.max(24, ...values.map((value, i) => pdf.heightOfString(value, {
            width: widths[i] - padding * 2 - (i === (landscape ? 1 : 0) ? indent : 0), lineGap: 2,
          }) + padding * 2));
        };
        const draw = (values: string[], height: number, bold: boolean, indent = 0) => {
          let x = margin;
          pdf.font(bold ? "Times-Bold" : "Times-Roman").fontSize(fontSize);
          values.forEach((value, i) => {
            if (bold) pdf.rect(x, y, widths[i], height).fill("#eeeeee");
            pdf.lineWidth(.5).rect(x, y, widths[i], height).stroke("#000000");
            const offset = i === (landscape ? 1 : 0) ? indent : 0;
            const options = { width: widths[i] - padding * 2 - offset, lineGap: 2, align: bold ? "center" as const : block.columns[i].align ?? "left" };
            const h = pdf.heightOfString(value, options);
            pdf.fillColor("#000000").text(value, x + padding + offset, y + (height - h) / 2, options); x += widths[i];
          }); y += height;
        };
        const headings = block.columns.map(col => col.title);
        const headerHeight = cellHeight(headings, true);
        const rows = emptyRows(block);
        if (y + headerHeight + cellHeight(rows[0], false) > bottom()) page();
        draw(headings, headerHeight, true);
        for (const [i, row] of rows.entries()) {
          const indent = Math.min(4, block.indents?.[i] ?? 0) * 9;
          const height = cellHeight(row, false, indent);
          if (y + height > bottom()) { page(); draw(headings, headerHeight, true); }
          draw(row, height, false, indent);
        }
        y += 14;
      }
    }
  }
  const range = pdf.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    pdf.switchToPage(i); pdf.fillColor("#000000").font("Times-Roman").fontSize(9);
    if (i > 0) pdf.text(`PROFIL KEPEGAWAIAN DINAS  |  DATA PER ${report.dateLabel.toUpperCase()}`, margin, 27, { width: width(), align: "center", lineGap: 0 });
    pdf.text(`- ${i + 1} -`, margin, pdf.page.height - 32, { width: width(), align: "center", lineGap: 0 });
  }
  pdf.end(); return result;
}

// A small deterministic OOXML writer keeps the production export independent
// of a desktop Word installation. All text is escaped before entering XML.
const xml = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const runs = (value: string) => value.split("\n").map((line, i) => `${i ? "<w:r><w:br/></w:r>" : ""}<w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r>`).join("");
const p = (value: string, style = "Normal", extra = "") => `<w:p><w:pPr><w:pStyle w:val="${style}"/>${extra}</w:pPr>${runs(value)}</w:p>`;
const sectPr = (landscape: boolean) => `<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:type w:val="nextPage"/><w:pgSz w:w="${landscape ? 16838 : 11906}" w:h="${landscape ? 11906 : 16838}"${landscape ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="450" w:footer="450"/><w:pgNumType w:fmt="decimal"/></w:sectPr>`;
export function createStaffProfileDocx(report: StaffProfileReport): Buffer {
  const zip = new PizZip();
  const cover = `<w:spacing w:before="1800" w:after="300"/>`;
  let body = p(title, "Title", cover) + p(PROFILE_ORGANIZATION.toUpperCase(), "Subtitle")
    + p(`KEADAAN PER ${report.dateLabel.toUpperCase()}`, "Center")
    + p(`PROYEKSI PENSIUN TAHUN ${report.startYear} SAMPAI DENGAN ${report.endYear}`, "Center")
    + p(scope, "Center", '<w:spacing w:before="900" w:after="400"/>')
    + p(`Profil ini menyajikan ${report.summary.active} pegawai aktif dan pembanding kebutuhan ${report.summary.required} pegawai berdasarkan peta jabatan. Laporan beserta tiga lampirannya digunakan sebagai bahan pemutakhiran data dan perencanaan kepegawaian dinas.`)
    + p(`KABUPATEN INDRAMAYU\n${report.today.slice(0, 4)}`, "Center", '<w:spacing w:before="1800"/>')
    + p("DAFTAR ISI", "Heading1", "<w:pageBreakBefore/>");
  report.sections.forEach(section => { body += p(`${section.title}   ${section.subtitle}`, "Contents"); });
  body += p("Data mencerminkan keadaan saat dokumen diunduh. Periode proyeksi tidak mengubah tanggal keadaan data.");
  let wide = false;
  for (const section of report.sections) {
    const changed = !!section.landscape !== wide;
    if (changed) { body += `<w:p><w:pPr>${sectPr(wide)}</w:pPr></w:p>`; wide = !!section.landscape; }
    body += p(section.title, "Heading1", changed ? "" : "<w:pageBreakBefore/>") + p(section.subtitle.toUpperCase(), "ChapterSubtitle");
    for (const block of section.blocks) {
      if (block.type !== "table") { body += p(block.text, block.type === "heading" ? "Heading2" : "Normal"); continue; }
      const total = block.columns.reduce((n, col) => n + col.weight, 0), available = (wide ? 16838 : 11906) - 2268;
      const widths = block.columns.map(col => Math.floor(available * col.weight / total));
      widths[widths.length - 1] += available - widths.reduce((n, w) => n + w, 0);
      const rowXml = (values: string[], header: boolean, index = 0) => `<w:tr><w:trPr><w:cantSplit/>${header ? "<w:tblHeader/>" : ""}</w:trPr>${values.map((value, i) => {
        const indent = !header && i === (wide ? 1 : 0) ? Math.min(4, block.indents?.[index] ?? 0) * 180 : 0;
        return `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/><w:vAlign w:val="center"/>${header ? '<w:shd w:fill="EEEEEE"/>' : ""}</w:tcPr>${p(value, header ? "TableHeader" : wide ? "TableWide" : "TableText", `<w:jc w:val="${header ? "center" : block.columns[i].align ?? "left"}"/>${indent ? `<w:ind w:left="${indent}"/>` : ""}`)}</w:tc>`;
      }).join("")}</w:tr>`;
      body += `<w:tbl><w:tblPr><w:tblW w:w="${available}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(edge => `<w:${edge} w:val="single" w:sz="4" w:color="000000"/>`).join("")}</w:tblBorders><w:tblCellMar><w:top w:w="90" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rowXml(block.columns.map(c => c.title), true)}${emptyRows(block).map((row, i) => rowXml(row, false, i)).join("")}</w:tbl>${p("", "TableAfter")}`;
    }
  }
  body += sectPr(wide);
  const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${ns}><w:body>${body}</w:body></w:document>`);
  const style = (id: string, size: number, bold = false, props = "") => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id}"/><w:basedOn w:val="Normal"/><w:pPr>${props}</w:pPr><w:rPr><w:color w:val="000000"/><w:sz w:val="${size}"/>${bold ? "<w:b/>" : ""}</w:rPr></w:style>`;
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8"?><w:styles ${ns}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="23"/><w:color w:val="000000"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="290" w:lineRule="auto"/><w:jc w:val="both"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${style("Title", 34, true, '<w:jc w:val="center"/><w:keepNext/>')}${style("Subtitle", 28, true, '<w:jc w:val="center"/><w:spacing w:after="400"/>')}${style("Center", 24, false, '<w:jc w:val="center"/>')}${style("Heading1", 24, true, '<w:jc w:val="center"/><w:keepNext/><w:outlineLvl w:val="0"/><w:spacing w:after="80"/>')}${style("ChapterSubtitle", 24, true, '<w:jc w:val="center"/><w:keepNext/><w:spacing w:after="300"/>')}${style("Heading2", 23, true, '<w:jc w:val="left"/><w:keepNext/><w:outlineLvl w:val="1"/><w:spacing w:before="180" w:after="120"/>')}${style("Contents", 23, false, '<w:jc w:val="left"/><w:spacing w:after="200"/>')}${style("TableText", 20, false, '<w:spacing w:after="0" w:line="250" w:lineRule="auto"/>')}${style("TableWide", 19, false, '<w:spacing w:after="0" w:line="250" w:lineRule="auto"/>')}${style("TableHeader", 20, true, '<w:spacing w:after="0" w:line="250" w:lineRule="auto"/><w:keepNext/>')}${style("TableAfter", 10, false, '<w:spacing w:after="100"/>')}</w:styles>`);
  zip.file("word/footer1.xml", `<?xml version="1.0" encoding="UTF-8"?><w:ftr ${ns}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">- </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve"> -</w:t></w:r></w:p></w:ftr>`);
  const relationships = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships ${relationships}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0"?><Relationships ${relationships}><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`);
  zip.file("docProps/core.xml", `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:creator>${PROFILE_ORGANIZATION}</dc:creator><dc:description>Data per ${report.dateLabel}</dc:description></cp:coreProperties>`);
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
