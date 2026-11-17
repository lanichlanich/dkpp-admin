import "server-only";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import source from "@/data/retirement-position-map-2026.json";
import type { ProjectedEmployee, RetirementProjection } from "@/lib/retirement-projection";
import { buildProjectionHierarchy, employeeHierarchyLevel, selectProjectionHierarchy, sortProjectionEmployees } from "@/lib/retirement-projection-hierarchy";

type Column = { title: string; width: number; weight: number; numeric?: boolean; text?: boolean };
type Section = { title: string; columns: Column[]; rows: (string | number)[][] };
type PdfRowStyle = { depth: number; bold: boolean; context: boolean };
type PdfSection = Section & { rowStyles?: PdfRowStyle[]; indentColumn?: number };
const c = (title: string, width: number, weight: number, numeric = false): Column => ({ title, width, weight, numeric });
const organization = "DINAS KETAHANAN PANGAN DAN PERTANIAN KABUPATEN INDRAMAYU";

function sections(p: RetirementProjection): Section[] {
  const details = (employees: ProjectedEmployee[], review: boolean): Section => ({
    title: review ? "Perlu Verifikasi" : "Pegawai Pensiun",
    columns: [c("No", 6, 24, true), { ...c("NIP", 23, 104), text: true }, c("Nama pegawai", 34, 130),
      c("Jabatan", 47, 160), c("Unit penempatan", 45, 145), c("Jenis jabatan", 17, 62), c("Jenis ASN", 14, 48),
      c("BUP", 9, 30, true), c("TMT pensiun", 16, 68), c("Keterangan", 58, review ? 170 : 100)],
    rows: employees.map((e, i) => [i + 1, e.nip, e.name, e.position, e.mappedUnit, e.kind, e.asnType,
      e.retirementAge ?? "Belum diketahui", e.retirementTmt ?? "Belum diketahui",
      [...e.issues, ...(e.asnType !== "PNS" ? ["Proyeksi BUP jabatan; bukan akhir kontrak PPPK"] : [])].join("; ") || "Terpetakan"]),
  });
  return [{ title: "Ringkasan", columns: [c("Jenis jabatan", 20, 100), c("Tahun", 12, 55, true),
    c("Kebutuhan", 15, 70, true), c("Aktif terpetakan", 20, 95, true), c("Pensiun tahun ini", 21, 105, true),
    c("Sisa terpetakan akhir tahun", 27, 130, true), c("Kekurangan per penempatan", 27, 135, true), c("Kelebihan per penempatan", 27, 130, true)],
    rows: p.summaries.flatMap(group => p.years.map((year, i) => [group.kind, year, group.required, group.mappedActive,
      p.rows.filter(row => row.kind === group.kind).reduce((n, row) => n + row.retirements[i], 0),
      p.rows.filter(row => row.kind === group.kind).reduce((n, row) => n + row.remaining[i], 0), group.shortage[i], group.surplus[i]])),
  }, { title: "Rekap Jabatan", columns: [c("Jabatan", 51, 135), c("Unit penempatan", 48, 125), c("Jenis", 17, 54),
    c("Kebutuhan", 13, 55, true), c("Aktif", 10, 35, true), ...p.years.map(year => c(`Pensiun ${year}`, 15, 40, true)),
    c("Total pensiun", 16, 44, true), c(`Sisa ${p.years[4]}`, 15, 42, true), c(`Kurang ${p.years[4]}`, 16, 44, true),
    c("Sumber", 24, 72)],
    rows: p.rows.map(row => [row.name, row.unit, row.kind, row.required, row.active, ...row.retirements,
      row.totalRetirements, row.remaining[4], row.shortage[4], `Hal. ${row.page}, No. ${row.sourceRow}`]),
  }, details(p.retirees, false), details(p.review, true)];
}

export function projectionReportNotes(p: RetirementProjection) {
  return [
    `Sumber: Peta Jabatan DKPP 2026, Kep. Bupati ${source.decree}, ${source.decreeDate}. Total kebutuhan sumber: 253.`,
    `Data per ${p.today}. Periode ${p.years[0]}-${p.years[4]}. Jenis: ${p.filters.kind === "all" ? "Semua" : p.filters.kind}; unit: ${p.filters.unit || "Semua"}; ASN: ${p.filters.asn}; pencarian: ${p.filters.search || "-"}.`,
    `${p.employees.length} pegawai aktif; ${p.mappedActive} terpetakan; ${p.unmapped} belum terpetakan; ${p.unknownDates} TMT belum diketahui; ${p.retirees.length} proyeksi pensiun (termasuk yang belum terpetakan).`,
    `Rekap kebutuhan/sisa/kekurangan hanya memakai penempatan yang cocok. ${p.beforePeriod} pegawai dengan TMT sebelum periode dikurangkan dari sisa. TMT yang belum diketahui tetap dihitung dalam sisa dan perlu diverifikasi.`,
    "Sisa akhir tahun = aktif terpetakan dikurangi seluruh TMT sampai akhir tahun. Kekurangan dijumlah per penempatan; kelebihan di unit lain tidak menutup kekurangan tersebut. Asumsi belum ada penerimaan, mutasi, atau perubahan jabatan.",
    "PPPK: proyeksi BUP jabatan, bukan akhir kontrak. Jika ASN/pencarian difilter, keterisian dan selisih hanya mencerminkan cakupan yang dipilih.",
  ];
}

export async function createProjectionExcel(p: RetirementProjection) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DKPP-Admin";
  workbook.created = new Date(`${p.today}T00:00:00Z`);
  for (const section of sections(p)) {
    const sheet = workbook.addWorksheet(section.title, { views: [{ state: "frozen", xSplit: section.title === "Rekap Jabatan" ? 2 : 1, ySplit: 4 }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "4:4" } });
    const n = section.columns.length;
    for (const [i, column] of section.columns.entries()) {
      sheet.getColumn(i + 1).width = column.width;
      if (column.text) sheet.getColumn(i + 1).numFmt = "@";
    }
    const meta = [`PROYEKSI PENSIUN PEGAWAI ${p.years[0]}-${p.years[4]} - ${section.title.toUpperCase()}`,
      organization, `Data per ${p.today} | Sumber peta jabatan 2026 | ${p.filters.kind} | ${p.filters.unit || "Semua unit"} | ASN ${p.filters.asn} | Cari: ${p.filters.search || "-"}`];
    for (let i = 0; i < meta.length; i++) {
      sheet.mergeCells(i + 1, 1, i + 1, n); sheet.getCell(i + 1, 1).value = meta[i];
      sheet.getRow(i + 1).height = i === 0 ? 30 : 25;
    }
    sheet.getCell("A1").font = { size: 15, bold: true, color: { argb: "FF3730A3" } };
    sheet.addRow(section.columns.map(column => column.title));
    sheet.getRow(4).height = 34;
    sheet.getRow(4).eachCell(c => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3730A3" } };
      c.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    });
    for (const [index, values] of section.rows.entries()) {
      const row = sheet.addRow(values);
      row.height = Math.max(30, ...values.map((value, i) => Math.ceil(String(value).length / Math.max(10, section.columns[i].width - 3)) * 14 + 10));
      row.eachCell({ includeEmpty: true }, (cell, i) => {
        cell.font = { size: 10, color: { argb: "FF18181B" } };
        cell.alignment = { wrapText: true, vertical: "middle", horizontal: section.columns[i - 1].numeric ? "center" : "left" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 ? "FFFFFFFF" : "FFF5F3FF" } };
        cell.border = { bottom: { style: "thin", color: { argb: "FFE4E4E7" } } };
      });
    }
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, 4 + section.rows.length), column: n } };
    if (!section.rows.length) { const row = sheet.addRow(["Tidak ada data dalam cakupan ini."]); sheet.mergeCells(row.number, 1, row.number, n); }
    sheet.addRow([]);
    for (const note of projectionReportNotes(p)) {
      const row = sheet.addRow([note]); sheet.mergeCells(row.number, 1, row.number, n);
      row.height = 32; row.getCell(1).alignment = { wrapText: true, vertical: "middle" }; row.getCell(1).font = { size: 9, color: { argb: "FF52525B" } };
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function createProjectionPdf(p: RetirementProjection) {
  const pdf = new PDFDocument({ size: "A4", layout: "landscape", margin: 0, bufferPages: true,
    info: { Title: `Proyeksi Pensiun ${p.years[0]}-${p.years[4]}`, Author: organization } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk)); pdf.on("end", () => resolve(Buffer.concat(chunks))); pdf.on("error", reject);
  });
  const left = 42, width = pdf.page.width - 84, bottom = pdf.page.height - 42;
  const bodySize = 9, headerSize = 9, padding = 5;
  const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(`${p.today}T00:00:00Z`));
  let first = true;
  // Keep the Excel columns intact; the PDF has its own appendix-style layout.
  const hierarchy = buildProjectionHierarchy(source.positions);
  const sorted = { ...p, retirees: sortProjectionEmployees(hierarchy, p.retirees), review: sortProjectionEmployees(hierarchy, p.review) };
  const pdfSections: PdfSection[] = sections(sorted).map(section => {
    const indices = section.columns.map((_, i) => i).filter(i => section.columns[i].title !== "Sumber");
    const columns = indices.map(i => section.columns[i]);
    const rows = section.rows.map(row => indices.map(i => row[i]));
    if (section.title === "Rekap Jabatan") {
      const selected = new Map(p.rows.map(row => [row.id, row]));
      const nodes = selectProjectionHierarchy(hierarchy, [...selected.keys()]);
      let number = 0;
      return { ...section, columns: [c("No.", 6, 24, true), ...columns], indentColumn: 1,
        rowStyles: nodes.map(node => ({ depth: node.depth, bold: node.position.kind === "Struktural", context: node.context })),
        rows: nodes.map(node => {
          const row = selected.get(node.position.id);
          return row ? [++number, row.name, row.unit, row.kind, row.required, row.active, ...row.retirements,
            row.totalRetirements, row.remaining[4], row.shortage[4]]
            : ["", node.position.name, node.position.unit, node.position.kind, ...Array<string>(10).fill("-")];
        }) };
    }
    const employees = section.title === "Pegawai Pensiun" ? sorted.retirees : section.title === "Perlu Verifikasi" ? sorted.review : null;
    return { ...section, columns, rows, ...(employees ? { indentColumn: 3,
      rowStyles: employees.map(employee => ({ depth: employeeHierarchyLevel(hierarchy, employee).depth, bold: employee.kind === "Struktural", context: false })) } : {}) };
  });
  for (const [sectionIndex, section] of pdfSections.entries()) {
    const yearColumns = section.columns.map((column, i) => column.title.startsWith("Pensiun ") ? i : -1).filter(i => i >= 0);
    const grouped = section.title === "Rekap Jabatan" && yearColumns.length === 5;
    const minimumWidths = section.columns.map((column, i) => {
      const label = grouped && yearColumns.includes(i) ? column.title.replace("Pensiun ", "") : column.title.toUpperCase();
      pdf.font("Times-Bold").fontSize(headerSize);
      const headingWidth = Math.max(...label.split(/\s+/).map(word => pdf.widthOfString(word)));
      pdf.font("Times-Roman").fontSize(bodySize);
      const atomic = column.numeric || column.text || ["Jenis", "Jenis jabatan", "Jenis ASN", "TMT pensiun"].includes(column.title);
      const valueWidth = atomic ? Math.max(0, ...section.rows.flatMap(row => String(row[i]).split(/\s+/).map(word => pdf.widthOfString(word)))) : 50;
      return Math.max(headingWidth, valueWidth) + 2 * padding + 1;
    });
    const remainingWidth = Math.max(0, width - minimumWidths.reduce((n, value) => n + value, 0));
    const flexible = section.columns.map(column => ["Nama pegawai", "Jabatan", "Unit penempatan", "Keterangan"].includes(column.title));
    const hasFlexible = flexible.some(Boolean);
    const weight = section.columns.reduce((n, column, i) => n + (!hasFlexible || flexible[i] ? column.weight : 0), 0);
    let x = left;
    const cols = section.columns.map((column, i) => {
      const extra = !hasFlexible || flexible[i] ? remainingWidth * column.weight / weight : 0;
      const item = { ...column, x, w: minimumWidths[i] + extra }; x += item.w; return item;
    });
    const sectionTitle = `${["I", "II", "III", "IV"][sectionIndex]}. ${section.title.toUpperCase()}`;
    const inner = (i: number) => cols[i].w - 2 * padding;
    const measure = (text: string, font: string, size: number, cellWidth: number) => {
      pdf.font(font).fontSize(size);
      return pdf.heightOfString(text, { width: cellWidth, lineGap: 1 });
    };
    const textInCell = (text: string, i: number, top: number, height: number, bold = false, center = false, indent = 0) => {
      const font = bold ? "Times-Bold" : "Times-Roman", size = bold ? headerSize : bodySize;
      const textHeight = measure(text, font, size, inner(i) - indent);
      pdf.fillColor("black").text(text, cols[i].x + padding + indent, top + (height - textHeight) / 2,
        { width: inner(i) - indent, lineGap: 1, align: center || cols[i].numeric ? "center" : "left" });
    };
    const header = (continuation = false) => {
      if (!first) pdf.addPage(); first = false;
      pdf.fillColor("black").strokeColor("black");
      let top: number;
      if (continuation) {
        pdf.font("Times-Bold").fontSize(11).text(`${sectionTitle} (LANJUTAN)`, left, 34, { width, align: "center" });
        pdf.font("Times-Roman").fontSize(9).text(`TAHUN ${p.years[0]} - ${p.years[4]}`, left, 51, { width, align: "center" });
        top = 73;
      } else {
        const headings = ["PROYEKSI PENSIUN PEGAWAI", "DINAS KETAHANAN PANGAN DAN PERTANIAN", "KABUPATEN INDRAMAYU", `TAHUN ${p.years[0]} - ${p.years[4]}`];
        for (const [i, title] of headings.entries()) pdf.font("Times-Bold").fontSize(11).text(title, left, 31 + i * 15, { width, align: "center" });
        pdf.fontSize(10).text(sectionTitle, left, 100, { width, align: "center" });
        const contextNote = section.rowStyles?.some(style => style.context) ? " Baris induk di luar filter hanya menjadi konteks, tanpa angka rekap." : "";
        const scope = `Keadaan data: ${date}. Jenis jabatan: ${p.filters.kind === "all" ? "Semua" : p.filters.kind}. Unit: ${p.filters.unit || "Semua"}. ASN: ${p.filters.asn === "all" ? "Semua" : p.filters.asn}. Pencarian: ${p.filters.search || "-"}.${contextNote}`;
        const scopeHeight = measure(scope, "Times-Roman", 8.5, width);
        pdf.text(scope, left, 121, { width, lineGap: 1 });
        top = 121 + scopeHeight + 10;
      }
      const height = Math.max(grouped ? 46 : 32, ...cols.map((column, i) =>
        yearColumns.includes(i) && grouped ? 0 : measure(column.title.toUpperCase(), "Times-Bold", headerSize, inner(i)) + 2 * padding));
      pdf.rect(left, top, width, height).fill("#e6e6e6");
      pdf.lineWidth(0.7).rect(left, top, width, height).stroke("black");
      const groupStart = grouped ? yearColumns[0] : -1, groupEnd = grouped ? yearColumns[4] : -1;
      for (const [i, column] of cols.entries()) {
        if (i > 0) pdf.moveTo(column.x, top + (grouped && i > groupStart && i <= groupEnd ? height / 2 : 0))
          .lineTo(column.x, top + height).stroke();
        if (grouped && yearColumns.includes(i)) textInCell(String(p.years[i - groupStart]), i, top + height / 2, height / 2, true, true);
        else textInCell(column.title.toUpperCase(), i, top, height, true, true);
      }
      if (grouped) {
        const groupLeft = cols[groupStart].x, groupWidth = cols.slice(groupStart, groupEnd + 1).reduce((n, col) => n + col.w, 0);
        pdf.moveTo(groupLeft, top + height / 2).lineTo(groupLeft + groupWidth, top + height / 2).stroke();
        const text = "JUMLAH PEGAWAI PENSIUN", textHeight = measure(text, "Times-Bold", headerSize, groupWidth - 2 * padding);
        pdf.text(text, groupLeft + padding, top + (height / 2 - textHeight) / 2,
          { width: groupWidth - 2 * padding, align: "center", lineGap: 1 });
      }
      return top + height;
    };
    let y = header();
    if (!section.rows.length) {
      pdf.lineWidth(0.5).rect(left, y, width, 30).stroke("black");
      pdf.font("Times-Roman").fontSize(bodySize).text("Tidak ada data dalam cakupan ini.", left + padding, y + 10, { width: width - 2 * padding, align: "center" }); y += 30;
    }
    const rowHeight = (values: (string | number)[], index: number) => Math.max(section.title === "Ringkasan" ? 24 : 26,
      ...values.map((value, j) => {
        const style = section.rowStyles?.[index], indented = j === section.indentColumn;
        return measure(String(value), indented && style?.bold ? "Times-Bold" : "Times-Roman", bodySize,
          inner(j) - (indented ? (style?.depth ?? 0) * 10 : 0)) + 2 * padding;
      }));
    for (const [index, values] of section.rows.entries()) {
      const style = section.rowStyles?.[index], height = rowHeight(values, index);
      const next = section.rows[index + 1], nextStyle = section.rowStyles?.[index + 1];
      const following = next && style?.bold && nextStyle && nextStyle.depth > style.depth ? rowHeight(next, index + 1) : 0;
      if (y + height + following > bottom) y = header(true);
      pdf.lineWidth(0.5).strokeColor("black").rect(left, y, width, height).stroke();
      for (let j = 0; j < values.length; j++) {
        if (j > 0) pdf.moveTo(cols[j].x, y).lineTo(cols[j].x, y + height).stroke();
        const indented = j === section.indentColumn;
        textInCell(String(values[j]), j, y, height, indented && !!style?.bold, false, indented ? (style?.depth ?? 0) * 10 : 0);
      }
      y += height;
    }
    if (section.title === "Ringkasan") {
      let notesStarted = false;
      for (const note of projectionReportNotes(p)) {
        const height = measure(note, "Times-Roman", 9, width) + 7;
        if (y + height + (notesStarted ? 7 : 32) > bottom) {
          pdf.addPage(); pdf.font("Times-Bold").fontSize(11).text("CATATAN PROYEKSI", left, 34, { width, align: "center" }); y = 58; notesStarted = true;
        }
        if (!notesStarted) { pdf.font("Times-Bold").fontSize(9).text("Catatan:", left, y + 13, { width }); y += 30; notesStarted = true; }
        pdf.font("Times-Roman").fontSize(9).fillColor("black").text(note, left, y + 5, { width, lineGap: 1 }); y += height;
      }
    }
  }
  const { count } = pdf.bufferedPageRange();
  for (let page = 0; page < count; page++) {
    pdf.switchToPage(page); pdf.font("Times-Roman").fontSize(10).fillColor("black").text(`- ${page + 1} -`, left, pdf.page.height - 27, { width, align: "center", lineBreak: false });
  }
  pdf.end(); return result;
}
