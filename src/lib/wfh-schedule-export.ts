import "server-only";

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { fridayDates, groupScheduleEntries, monthLabel, type ScheduleEntry } from "@/lib/wfh-schedule";

function dateHeading(date: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
}

export async function createScheduleExcel(period: string, entries: ScheduleEntry[]) {
  const dates = fridayDates(period);
  const rows = groupScheduleEntries(entries);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DKPP-Admin";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(`WFH WFO ${period}`, {
    views: [{ state: "frozen", xSplit: 5, ySplit: 3 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const widths = [6, 31, 22, 43, 55, ...dates.map(() => 16), 27, 7];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  for (const [index, label] of ["No", "Nama", "NIP", "Jabatan", "Unit Organisasi"].entries()) {
    const column = String.fromCharCode(65 + index);
    sheet.mergeCells(`${column}1:${column}2`);
    sheet.getCell(`${column}1`).value = label;
  }
  if (dates.length) {
    const lastDateColumn = String.fromCharCode(69 + dates.length);
    sheet.mergeCells(`F1:${lastDateColumn}1`);
    sheet.getCell("F1").value = `Jadwal Jumat ${monthLabel(period)}`;
  }
  dates.forEach((date, index) => { sheet.getCell(2, 6 + index).value = new Date(`${date}T00:00:00Z`); sheet.getCell(2, 6 + index).numFmt = "dd mmmm yyyy"; });
  const legendColumn = 6 + dates.length;
  sheet.getCell(1, legendColumn).value = "Work From Home (WFH)";
  sheet.getCell(1, legendColumn + 1).value = "✓";
  sheet.getCell(2, legendColumn).value = "Work From Office (WFO)";
  sheet.getCell(2, legendColumn + 1).value = "✖";
  for (let column = 1; column <= 5 + dates.length; column++) sheet.getCell(3, column).value = column;
  sheet.getRow(1).height = 25;
  sheet.getRow(2).height = 25;

  for (const [index, row] of rows.entries()) {
    const excelRow = sheet.getRow(index + 4);
    excelRow.values = [index + 1, row.employee.name, row.employee.nip, row.employee.position, row.employee.unit,
      ...dates.map((date) => row.statuses.get(date) === "WFH" ? "✓" : "✖")];
    excelRow.height = 25;
    excelRow.getCell(3).numFmt = "@";
    excelRow.alignment = { vertical: "middle", wrapText: true };
    for (let column = 6; column < 6 + dates.length; column++) {
      const cell = excelRow.getCell(column);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: row.statuses.get(dates[column - 6]) === "WFH" ? "FF047857" : "FF1D4ED8" } };
    }
  }
  const lastRow = rows.length + 4;
  sheet.getCell(lastRow, 2).value = "Jumlah WFH";
  sheet.getCell(lastRow + 1, 2).value = "Jumlah WFO";
  dates.forEach((date, index) => {
    const wfh = rows.filter((row) => row.statuses.get(date) === "WFH").length;
    sheet.getCell(lastRow, 6 + index).value = wfh;
    sheet.getCell(lastRow + 1, 6 + index).value = rows.length - wfh;
  });
  const endColumn = 5 + dates.length;
  for (let row = 1; row <= lastRow + 1; row++) {
    for (let column = 1; column <= endColumn; column++) {
      const cell = sheet.getCell(row, column);
      cell.border = { top: { style: "thin", color: { argb: "FFD1D5DB" } }, left: { style: "thin", color: { argb: "FFD1D5DB" } }, bottom: { style: "thin", color: { argb: "FFD1D5DB" } }, right: { style: "thin", color: { argb: "FFD1D5DB" } } };
      if (row <= 3) { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } }; cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF064E3B" } }; cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; }
      else if (row >= lastRow) { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } }; cell.font = { name: "Calibri", size: 11, bold: true }; }
      else if (row % 2 === 0) { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } }; }
    }
  }
  sheet.pageSetup.printTitlesRow = "1:3";
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function createSchedulePdf(period: string, entries: ScheduleEntry[]) {
  const dates = fridayDates(period);
  const rows = groupScheduleEntries(entries);
  const pdf = new PDFDocument({ size: "A3", layout: "landscape", margin: 28, bufferPages: true });
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve, reject) => {
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });
  const columns = [28, 168, 116, 182, 240, ...dates.map(() => 78)];
  const startX = 28;
  const rowHeight = 24;
  const tableWidth = columns.reduce((sum, width) => sum + width, 0);

  function drawRow(y: number, values: string[], header = false) {
    let x = startX;
    values.forEach((value, index) => {
      const width = columns[index];
      pdf.rect(x, y, width, rowHeight).fillAndStroke(header ? "#DCFCE7" : "#FFFFFF", "#CBD5E1");
      pdf.fillColor(header ? "#064E3B" : "#111827").font(header ? "Helvetica-Bold" : "Helvetica")
        .fontSize(index >= 5 ? 8 : 7.2).text(value, x + 3, y + 4, { width: width - 6, height: rowHeight - 7, align: index >= 5 ? "center" : "left", ellipsis: true });
      x += width;
    });
  }

  function pageHeader() {
    pdf.font("Helvetica-Bold").fontSize(15).fillColor("#064E3B").text("DAFTAR PEGAWAI WFH / WFO", startX, 27);
    pdf.font("Helvetica").fontSize(10).fillColor("#374151").text(`DKPP Kabupaten Indramayu - ${monthLabel(period)}`, startX, 48);
    pdf.fontSize(8).text("WFH = Work From Home   |   WFO = Work From Office", startX, 65);
    drawRow(82, ["No", "Nama", "NIP", "Jabatan", "Unit Organisasi", ...dates.map(dateHeading)], true);
  }

  pageHeader();
  let y = 82 + rowHeight;
  rows.forEach((row, index) => {
    if (y + rowHeight > pdf.page.height - 68) { pdf.addPage(); pageHeader(); y = 82 + rowHeight; }
    drawRow(y, [String(index + 1), row.employee.name, row.employee.nip, row.employee.position, row.employee.unit,
      ...dates.map((date) => row.statuses.get(date) ?? "WFO")]);
    y += rowHeight;
  });
  if (y + rowHeight * 2 > pdf.page.height - 45) { pdf.addPage(); pageHeader(); y = 82 + rowHeight; }
  const wfhCounts = dates.map((date) => rows.filter((row) => row.statuses.get(date) === "WFH").length);
  drawRow(y, ["", "Jumlah WFH", "", "", "", ...wfhCounts.map(String)], true);
  drawRow(y + rowHeight, ["", "Jumlah WFO", "", "", "", ...wfhCounts.map((count) => String(rows.length - count))], true);
  const pageCount = pdf.bufferedPageRange().count;
  for (let index = 0; index < pageCount; index++) {
    pdf.switchToPage(index);
    pdf.font("Helvetica").fontSize(8).fillColor("#6B7280").text(`Halaman ${index + 1} dari ${pageCount}`, startX, pdf.page.height - 40, { width: tableWidth, height: 10, align: "right", lineBreak: false });
  }
  pdf.end();
  return await complete;
}
