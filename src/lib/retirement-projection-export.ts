import "server-only";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import source from "@/data/retirement-position-map-2026.json";
import type { ProjectedEmployee, RetirementProjection } from "@/lib/retirement-projection";

type Column = { title: string; width: number; weight: number; numeric?: boolean; text?: boolean };
type Section = { title: string; columns: Column[]; rows: (string | number)[][] };
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
  const left = 28, width = pdf.page.width - 56, bottom = pdf.page.height - 38;
  let first = true;
  for (const section of sections(p)) {
    const weight = section.columns.reduce((n, column) => n + column.weight, 0);
    let x = left;
    const cols = section.columns.map(column => { const item = { ...column, x, w: width * column.weight / weight }; x += item.w; return item; });
    const header = () => {
      if (!first) pdf.addPage(); first = false;
      pdf.font("Helvetica-Bold").fontSize(9).fillColor("#4338ca").text(organization, left, 24, { width });
      pdf.fontSize(18).fillColor("#18181b").text(`Proyeksi Pensiun ${p.years[0]}-${p.years[4]}`, left, 43, { width });
      pdf.fontSize(11).fillColor("#4338ca").text(section.title, left, 69, { width });
      pdf.font("Helvetica").fontSize(8).fillColor("#52525b").text(`Data per ${p.today} | ${p.filters.kind === "all" ? "Semua jenis jabatan" : p.filters.kind} | ${p.filters.unit || "Semua unit"} | ASN: ${p.filters.asn === "all" ? "Semua" : p.filters.asn} | Cari: ${p.filters.search || "-"}`, left, 87, { width, height: 22 });
      pdf.rect(left, 115, width, 32).fill("#3730a3");
      for (const column of cols) pdf.font("Helvetica-Bold").fontSize(7.5).fillColor("white").text(column.title, column.x + 4, 123, { width: column.w - 8, align: column.numeric ? "center" : "left" });
      return 147;
    };
    let y = header();
    if (!section.rows.length) { pdf.font("Helvetica").fontSize(10).fillColor("#52525b").text("Tidak ada data dalam cakupan ini.", left + 6, y + 12, { width }); y += 38; }
    for (const [i, values] of section.rows.entries()) {
      pdf.font("Helvetica").fontSize(7.5);
      const height = Math.max(25, ...values.map((value, j) => pdf.heightOfString(String(value), { width: cols[j].w - 8 }) + 12));
      if (y + height > bottom) y = header();
      pdf.rect(left, y, width, height).fill(i % 2 ? "#ffffff" : "#f5f3ff");
      for (let j = 0; j < values.length; j++) pdf.font("Helvetica").fontSize(7.5).fillColor("#18181b").text(String(values[j]), cols[j].x + 4, y + 6, { width: cols[j].w - 8, align: cols[j].numeric ? "center" : "left" });
      pdf.moveTo(left, y + height).lineTo(left + width, y + height).strokeColor("#e4e4e7").lineWidth(0.4).stroke();
      y += height;
    }
    if (section.title === "Ringkasan") {
      for (const note of projectionReportNotes(p)) {
        pdf.font("Helvetica").fontSize(8);
        const height = pdf.heightOfString(note, { width }) + 10;
        if (y + height + 12 > bottom) { pdf.addPage(); pdf.font("Helvetica-Bold").fontSize(12).text("Catatan Proyeksi", left, 30, { width }); y = 55; }
        pdf.font("Helvetica").fontSize(8).fillColor("#52525b").text(note, left, y + 9, { width }); y += height;
      }
    }
  }
  const { count } = pdf.bufferedPageRange();
  for (let page = 0; page < count; page++) {
    pdf.switchToPage(page); pdf.font("Helvetica").fontSize(8).fillColor("#71717a").text(`DKPP | Peta jabatan 2026 | Halaman ${page + 1} dari ${count}`, left, pdf.page.height - 24, { width, lineBreak: false });
  }
  pdf.end(); return result;
}
