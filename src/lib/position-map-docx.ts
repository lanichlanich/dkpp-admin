import "server-only";
import PizZip from "pizzip";
import { buildPositionMapPages, type MapTable, type PositionMapPlan } from "@/lib/position-map-model";

const escape = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const run = (value: string) => value.split("\n").map((line, i) => `${i ? "<w:r><w:br/></w:r>" : ""}<w:r><w:t xml:space="preserve">${escape(line)}</w:t></w:r>`).join("");
const border = (enabled: boolean) => `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(edge => `<w:${edge} w:val="${enabled ? "single" : "nil"}" w:sz="4" w:color="000000"/>`).join("")}</w:tblBorders>`;
function tableXml(table: MapTable) {
  const widths = table.columns.map(w => Math.round(w * 20)), total = Math.round(table.width * 20);
  widths[widths.length - 1] += total - widths.reduce((n, w) => n + w, 0);
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${border(!!table.borders)}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="5" w:type="dxa"/><w:left w:w="12" w:type="dxa"/><w:bottom w:w="5" w:type="dxa"/><w:right w:w="12" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${table.rows.map((row, r) => `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${Math.round(table.heights[r] * 20)}" w:hRule="exact"/></w:trPr>${row.map((value, c) => {
    const centered = table.centered || c > 0 || (r === 0 && table.header), bold = r === 0 && (table.header || table.centered);
    const size = !table.centered && c > 0 ? table.fontSize <= 6.5 ? 5.5 : table.fontSize - .5 : table.fontSize;
    return `<w:tc><w:tcPr><w:tcW w:w="${widths[c]}" w:type="dxa"/>${!table.centered && c > 0 ? '<w:tcMar><w:left w:w="3" w:type="dxa"/><w:right w:w="3" w:type="dxa"/></w:tcMar>' : ""}${r === 0 && table.fill ? `<w:shd w:fill="${table.fill}"/>` : ""}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${Math.round((size + 1.2) * 20)}" w:lineRule="exact"/><w:jc w:val="${centered ? "center" : "left"}"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="${Math.round(size * 2)}"/>${bold ? "<w:b/>" : ""}</w:rPr></w:pPr>${run(value).replaceAll("<w:r>", `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="000000"/><w:sz w:val="${Math.round(size * 2)}"/>${bold ? "<w:b/>" : ""}</w:rPr>`)}</w:p></w:tc>`;
  }).join("")}</w:tr>`).join("")}</w:tbl><w:p><w:pPr><w:spacing w:after="0" w:line="1" w:lineRule="exact"/></w:pPr></w:p>`;
}

/** Native Word text boxes and tables preserve the reference geometry while
 * keeping every job name and K/B value editable in the downloaded document. */
export function createPositionMapDocx(plan: PositionMapPlan, year: number): Buffer {
  const pages = buildPositionMapPages(plan, year), zip = new PizZip();
  let id = 1;
  const style = (x: number, y: number, width: number, height: number, z: number) => `position:absolute;margin-left:${x}pt;margin-top:${y}pt;width:${width}pt;height:${height}pt;z-index:${z};mso-position-horizontal-relative:page;mso-position-vertical-relative:page`;
  const shape = (x: number, y: number, width: number, height: number, inner: string) => `<w:r><w:pict><v:shape id="MapText${id++}" type="#_x0000_t202" style="${style(x, y, width, height, 2)}" filled="f" stroked="f"><v:textbox inset="0,0,0,0" style="mso-fit-shape-to-text:f"><w:txbxContent>${inner}</w:txbxContent></v:textbox><w10:wrap type="none"/></v:shape></w:pict></w:r>`;
  const body = pages.map((page, pageIndex) => {
    const rects = page.rects.map(rect => `<w:r><w:pict><v:rect id="MapRect${id++}" style="${style(rect.x, rect.y, rect.width, rect.height, 1)}" fillcolor="#${rect.color}" stroked="f"><w10:wrap type="none"/></v:rect></w:pict></w:r>`).join("");
    const tables = page.tables.map(table => shape(table.x, table.y, table.width, table.heights.reduce((n, h) => n + h, 0) + 1, tableXml(table))).join("");
    const labels = page.labels.map(label => shape(label.x, label.y, label.width, label.size * 1.8,
      `<w:p><w:pPr><w:spacing w:after="0" w:line="${Math.round(label.size * 25)}" w:lineRule="exact"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="000000"/><w:sz w:val="${Math.round(label.size * 2)}"/>${label.bold ? "<w:b/>" : ""}</w:rPr><w:t>${escape(label.text)}</w:t></w:r></w:p>`)).join("");
    return `<w:p><w:pPr>${pageIndex ? "<w:pageBreakBefore/>" : ""}<w:spacing w:after="0" w:line="1" w:lineRule="exact"/></w:pPr>${rects}${tables}${labels}</w:p>`;
  }).join("");
  const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w10="urn:schemas-microsoft-com:office:word"';
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${ns}><w:body><w:p><w:pPr><w:spacing w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:pict><v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype></w:pict></w:r></w:p>${body}<w:sectPr><w:pgSz w:w="${Math.round(pages[0].width * 20)}" w:h="${Math.round(pages[0].height * 20)}" w:orient="landscape"/><w:pgMar w:top="360" w:right="360" w:bottom="360" w:left="360" w:header="0" w:footer="0"/></w:sectPr></w:body></w:document>`);
  zip.file("word/styles.xml", `<?xml version="1.0"?><w:styles ${ns}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="000000"/><w:sz w:val="13"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`);
  zip.file("word/settings.xml", `<?xml version="1.0"?><w:settings ${ns}><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`);
  const rels = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships ${rels}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0"?><Relationships ${rels}><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>`);
  zip.file("docProps/core.xml", `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Peta Jabatan DKPP Tahun ${year}</dc:title><dc:creator>DKPP Kabupaten Indramayu</dc:creator><dc:description>Bagan dinas dan rincian seluruh UPTD. Kebutuhan dan bezetting sesuai data peta jabatan tahun ${year}.</dc:description></cp:coreProperties>`);
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
