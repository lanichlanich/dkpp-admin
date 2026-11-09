import "server-only";

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { loanStatus, type LibraryBook, type LibraryLoan, type LibraryVisitor } from "@/lib/library-types";
import { libraryMonthLabel } from "@/lib/library-statistics-types";

type Cell = string | number | Date | null;
type Row = Record<string, Cell>;
type Column = { key: string; label: string; width: number; format?: "text" | "date" | "number" };
type PdfColumn = { label: string; weight: number; keys: string[]; align?: "left" | "center" | "right" };
type Report = {
  title: string;
  filename: string;
  sheet: string;
  scope: string;
  summary: string;
  empty: string;
  columns: Column[];
  pdfColumns: PdfColumn[];
  rows: Row[];
};

const organization = "Perpustakaan DKPP Kabupaten Indramayu";
const number = (value: number) => value.toLocaleString("id-ID");
const localDate = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" });
const date = (iso: string) => new Date(`${iso}T00:00:00Z`);
const activeLabel = (active: number) => active ? "Aktif" : "Nonaktif";

export function libraryBooksReport(books: LibraryBook[], today: string): Report {
  return {
    title: "Daftar Buku Perpustakaan",
    filename: `Daftar-Buku-DKPP-${today}`,
    sheet: "Daftar Buku",
    scope: `Inventaris per ${localDate.format(date(today))}`,
    summary: `${number(books.length)} entri buku | ${number(books.reduce((sum, book) => sum + book.copies, 0))} eksemplar tercatat`,
    empty: "Belum ada buku terdaftar.",
    columns: [
      { key: "no", label: "No.", width: 7 },
      { key: "inventoryCode", label: "Kode inventaris", width: 21, format: "text" },
      { key: "title", label: "Judul buku", width: 48 },
      { key: "isbn", label: "ISBN", width: 22, format: "text" },
      { key: "publisher", label: "Penerbit", width: 32 },
      { key: "publicationPlace", label: "Kota terbit", width: 22 },
      { key: "publicationYear", label: "Tahun terbit", width: 15, format: "text" },
      { key: "category", label: "Kategori", width: 25 },
      { key: "shelf", label: "Rak", width: 17 },
      { key: "copies", label: "Total stok", width: 14, format: "number" },
      { key: "borrowed", label: "Dipinjam", width: 13, format: "number" },
      { key: "available", label: "Tersedia", width: 13, format: "number" },
      { key: "status", label: "Status", width: 13 },
      { key: "notes", label: "Catatan", width: 55 },
    ],
    pdfColumns: [
      { label: "No.", weight: 28, keys: ["no"], align: "center" },
      { label: "Kode inventaris", weight: 83, keys: ["inventoryCode"] },
      { label: "Judul buku / ISBN", weight: 190, keys: ["title", "isbn"] },
      { label: "Penerbitan", weight: 145, keys: ["publisher", "publicationPlace", "publicationYear"] },
      { label: "Kategori / Rak", weight: 106, keys: ["category", "shelf"] },
      { label: "Total", weight: 45, keys: ["copies"], align: "right" },
      { label: "Dipinjam", weight: 51, keys: ["borrowed"], align: "right" },
      { label: "Tersedia", weight: 51, keys: ["available"], align: "right" },
      { label: "Status", weight: 60, keys: ["status"] },
    ],
    rows: books.map((book, index) => ({ ...book, no: index + 1, status: activeLabel(book.isActive) })),
  };
}

export function libraryVisitorsReport(visitors: LibraryVisitor[], today: string): Report {
  const activeCount = visitors.filter(visitor => visitor.isActive).length;
  return {
    title: "Daftar Pengunjung Perpustakaan",
    filename: `Daftar-Pengunjung-DKPP-${today}`,
    sheet: "Daftar Pengunjung",
    scope: `Pengunjung terdaftar per ${localDate.format(date(today))}`,
    summary: `${number(visitors.length)} pengunjung | ${number(activeCount)} aktif | ${number(visitors.length - activeCount)} nonaktif`,
    empty: "Belum ada pengunjung terdaftar.",
    columns: [
      { key: "no", label: "No.", width: 7 },
      { key: "cardNumber", label: "Nomor kartu", width: 26, format: "text" },
      { key: "name", label: "Nama pengunjung", width: 34 },
      { key: "type", label: "Jenis", width: 14 },
      { key: "employeeNip", label: "NIP", width: 24, format: "text" },
      { key: "organization", label: "Instansi / Unit kerja", width: 35 },
      { key: "phone", label: "Telepon", width: 22, format: "text" },
      { key: "address", label: "Alamat", width: 54 },
      { key: "status", label: "Status", width: 13 },
    ],
    pdfColumns: [
      { label: "No.", weight: 28, keys: ["no"], align: "center" },
      { label: "Nomor kartu / NIP", weight: 135, keys: ["cardNumber", "employeeNip"] },
      { label: "Nama / Jenis", weight: 144, keys: ["name", "type"] },
      { label: "Instansi / Unit kerja", weight: 139, keys: ["organization"] },
      { label: "Telepon", weight: 97, keys: ["phone"] },
      { label: "Alamat", weight: 175, keys: ["address"] },
      { label: "Status", weight: 58, keys: ["status"] },
    ],
    rows: visitors.map((visitor, index) => ({
      ...visitor, no: index + 1, type: visitor.employeeNip ? "Pegawai" : "Umum", status: activeLabel(visitor.isActive),
    })),
  };
}

export function libraryLoansReport(loans: LibraryLoan[], month: string, today: string): Report {
  const rows = loans.map((loan, index) => ({
    ...loan,
    no: index + 1,
    loanDate: date(loan.loanDate),
    dueDate: date(loan.dueDate),
    returnDate: loan.returnDate ? date(loan.returnDate) : null,
    status: loanStatus(loan, today),
  }));
  const returned = rows.filter(row => row.status === "Dikembalikan").length;
  const overdue = rows.filter(row => row.status === "Terlambat").length;
  const open = rows.length - returned - overdue;
  return {
    title: "Laporan Peminjaman Bulanan",
    filename: `Laporan-Peminjaman-DKPP-${month}`,
    sheet: "Peminjaman Bulanan",
    scope: `Tanggal pinjam: ${libraryMonthLabel(month)} | Status per ${localDate.format(date(today))}`,
    summary: `${number(rows.length)} transaksi | ${number(loans.reduce((sum, loan) => sum + loan.quantity, 0))} eksemplar | ${number(returned)} dikembalikan | ${number(open)} dipinjam | ${number(overdue)} terlambat`,
    empty: "Tidak ada transaksi dengan tanggal pinjam pada bulan ini.",
    columns: [
      { key: "no", label: "No.", width: 7 },
      { key: "inventoryCode", label: "Kode inventaris", width: 21, format: "text" },
      { key: "title", label: "Judul buku", width: 48 },
      { key: "cardNumber", label: "Nomor kartu", width: 26, format: "text" },
      { key: "name", label: "Nama peminjam", width: 34 },
      { key: "quantity", label: "Eksemplar", width: 13, format: "number" },
      { key: "loanDate", label: "Tanggal pinjam", width: 18, format: "date" },
      { key: "dueDate", label: "Jatuh tempo", width: 18, format: "date" },
      { key: "returnDate", label: "Tanggal kembali", width: 19, format: "date" },
      { key: "status", label: "Status", width: 19 },
      { key: "notes", label: "Catatan", width: 55 },
    ],
    pdfColumns: [
      { label: "No.", weight: 28, keys: ["no"], align: "center" },
      { label: "Buku / Kode inventaris", weight: 205, keys: ["title", "inventoryCode"] },
      { label: "Peminjam / Nomor kartu", weight: 162, keys: ["name", "cardNumber"] },
      { label: "Eks.", weight: 44, keys: ["quantity"], align: "right" },
      { label: "Tgl. pinjam", weight: 75, keys: ["loanDate"], align: "center" },
      { label: "Jatuh tempo", weight: 75, keys: ["dueDate"], align: "center" },
      { label: "Tgl. kembali", weight: 75, keys: ["returnDate"], align: "center" },
      { label: "Status", weight: 86, keys: ["status"] },
    ],
    rows,
  };
}

function displayCell(value: Cell) {
  if (value instanceof Date) {
    const [year, month, day] = value.toISOString().slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
  }
  return typeof value === "number" ? number(value) : (value ?? "").replace(/\s+/gu, " ").trim();
}

export async function createLibraryReportExcel(report: Report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = organization;
  const sheet = workbook.addWorksheet(report.sheet, {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const columnCount = report.columns.length;
  const dark = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } } as const;
  const band = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F7F4" } } as const;
  report.columns.forEach((column, index) => {
    const field = sheet.getColumn(index + 1);
    field.width = column.width;
    if (column.format === "text") field.numFmt = "@";
    if (column.format === "date") field.numFmt = "dd/mm/yyyy";
    if (column.format === "number") field.numFmt = "#,##0";
  });
  [report.title, `${organization} | ${report.scope}`, report.summary].forEach((value, index) => {
    const row = index + 1;
    sheet.mergeCells(row, 1, row, columnCount);
    const cell = sheet.getCell(row, 1);
    cell.value = value;
    cell.font = { name: "Calibri", size: row === 1 ? 17 : 11, bold: row !== 2, color: { argb: row === 1 ? "FFFFFFFF" : "FF14372D" } };
    cell.fill = row === 1 ? dark : band;
    cell.alignment = { vertical: "middle", indent: 1 };
    sheet.getRow(row).height = row === 1 ? 32 : 23;
  });
  const heading = sheet.addRow(report.columns.map(column => column.label));
  heading.height = 27;
  heading.eachCell(cell => {
    cell.fill = dark;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  report.rows.forEach((data, index) => {
    const values = report.columns.map(column => data[column.key]);
    const row = sheet.addRow(values);
    row.alignment = { vertical: "middle", wrapText: true };
    row.font = { name: "Calibri", size: 11, color: { argb: "FF172D25" } };
    const lines = values.map((value, col) => {
      if (typeof value !== "string") return 1;
      const width = Math.floor(report.columns[col].width * 0.8);
      return value.split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / width)), 0);
    });
    row.height = Math.min(408, Math.max(22, 14 * Math.max(...lines) + 6));
    if (index % 2 === 0) row.fill = band;
  });
  if (!report.rows.length) {
    sheet.mergeCells(5, 1, 5, columnCount);
    sheet.getCell(5, 1).value = report.empty;
    sheet.getRow(5).height = 24;
  } else {
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: sheet.rowCount, column: columnCount } };
  }
  sheet.pageSetup.printTitlesRow = "4:4";
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function createLibraryReportPdf(report: Report) {
  const pdf = new PDFDocument({
    size: "A4", layout: "landscape", margin: 0, bufferPages: true,
    info: { Title: report.title, Author: organization },
  });
  const chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });
  const left = 29;
  const width = pdf.page.width - 2 * left;
  const bodyTop = 153;
  const bodyEnd = pdf.page.height - 42;
  const padding = 6;
  const totalWeight = report.pdfColumns.reduce((sum, column) => sum + column.weight, 0);
  let x = left;
  const columns = report.pdfColumns.map(column => {
    const cellWidth = width * column.weight / totalWeight;
    const box = { ...column, x, width: cellWidth };
    x += cellWidth;
    return box;
  });
  const innerWidth = (column: { width: number }) => column.width - 2 * padding;

  function drawHeader() {
    pdf.rect(left, 29, 4, 53).fill("#047857");
    pdf.font("Helvetica-Bold").fontSize(10).fillColor("#047857").text(organization, left + 13, 30, { width: width - 13 });
    pdf.font("Helvetica-Bold").fontSize(20).fillColor("#102E24").text(report.title, left + 13, 47, { width: width - 13 });
    pdf.font("Helvetica").fontSize(9).fillColor("#3F5750").text(report.scope, left + 13, 73, { width: width - 13 });
    pdf.rect(left, 93, width, 24).fill("#EAF5EF");
    pdf.font("Helvetica-Bold").fontSize(9).fillColor("#124633").text(report.summary, left + 9, 101, { width: width - 18 });
    pdf.rect(left, 127, width, 26).fill("#064E3B");
    pdf.font("Helvetica-Bold").fontSize(8.5).fillColor("#FFFFFF");
    for (const column of columns) {
      pdf.text(column.label, column.x + padding, 136, { width: innerWidth(column), align: column.align });
    }
  }

  drawHeader();
  let y = bodyTop;
  if (!report.rows.length) {
    pdf.font("Helvetica").fontSize(10).fillColor("#40564E").text(report.empty, left + padding, y + 16, { width: width - 2 * padding });
  }
  for (const [index, row] of report.rows.entries()) {
    const texts = columns.map(column => column.keys.map(key => displayCell(row[key])).filter(Boolean).join("\n") || "-");
    const noteValue = row.notes ? displayCell(row.notes) : "";
    const note = noteValue ? `Catatan: ${noteValue}` : "";
    function measure(fontSize: number) {
      pdf.font("Helvetica").fontSize(fontSize);
      const textHeight = Math.max(...texts.map((text, i) => pdf.heightOfString(text, { width: innerWidth(columns[i]) })));
      const noteSize = Math.min(8, fontSize);
      const noteHeight = note ? pdf.fontSize(noteSize).heightOfString(note, { width: width - 2 * padding }) + padding : 0;
      return { textHeight, noteSize, height: Math.ceil(textHeight + 2 * padding + noteHeight) };
    }
    // Keep even the longest valid catalog records on one page without clipping their notes.
    let fontSize = 9;
    let layout = measure(fontSize);
    while (layout.height > bodyEnd - bodyTop && fontSize > 6) {
      fontSize -= 0.25;
      layout = measure(fontSize);
    }
    const { height, textHeight, noteSize } = layout;
    if (y + height > bodyEnd) {
      pdf.addPage();
      drawHeader();
      y = bodyTop;
    }
    pdf.rect(left, y, width, height).fill(index % 2 ? "#FFFFFF" : "#F3F8F5");
    pdf.moveTo(left, y + height).lineTo(left + width, y + height).lineWidth(0.45).strokeColor("#CFDFD6").stroke();
    pdf.font("Helvetica").fontSize(fontSize).fillColor("#162C24");
    columns.forEach((column, i) => {
      pdf.text(texts[i], column.x + padding, y + padding, { width: innerWidth(column), align: column.align });
    });
    if (note) pdf.fontSize(noteSize).fillColor("#40564E").text(note, left + padding, y + textHeight + 2 * padding, { width: width - 2 * padding });
    y += height;
  }

  const { count } = pdf.bufferedPageRange();
  for (let page = 0; page < count; page++) {
    pdf.switchToPage(page);
    pdf.font("Helvetica").fontSize(8).fillColor("#40564E").text(`Halaman ${page + 1} dari ${count}`, left, pdf.page.height - 27,
      { width, align: "right", lineBreak: false });
  }
  pdf.end();
  return complete;
}
