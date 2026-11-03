import "server-only";
import PDFDocument from "pdfkit";
import { terbilangRupiah } from "@/lib/kgb";
import { pltDateLabel } from "@/lib/plt-dates";
import { spjPeriodLabel } from "@/lib/spj-calendar";
import type { SpjSnapshot } from "@/lib/spj-types";

export type SpjPdfKind = "attendance" | "receipt";
export const SPJ_CELL_COLORS = { active: "#FFFFFF", holiday: "#C00000", inactive: "#595959" };
// Both supplied workbooks use A4 landscape, 6 mm side margins and 19 mm top/bottom margins.
const side = 17.55, top = 54.35;
const money = (value: number) => value.toLocaleString("id-ID");
// Point measurements from the templates' native Excel PDF exports, rather than estimated column widths.
const attendanceWidths = (days: number) => [17.4, 68.3, ...Array(days).fill(672.08 / 30), 22.42];
type Align = "left" | "center" | "right";
type Box = { x: number; width: number };
type TextStyle = { bold?: boolean; underline?: boolean; align?: Align; top?: boolean };
function font(pdf: PDFKit.PDFDocument, size: number, bold = false) {
  return pdf.fillColor("#000000").font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
}
function text(pdf: PDFKit.PDFDocument, value: string, box: Box, y: number, height: number, size: number, style: TextStyle = {}) {
  font(pdf, size, style.bold);
  const actual = pdf.heightOfString(value, { width: box.width, lineGap: 0 });
  const lineHeight = pdf.currentLineHeight(), lines = Math.max(1, Math.round(actual / lineHeight));
  const glyphHeight = size + (lines - 1) * lineHeight;
  pdf.text(value, box.x, y + (style.top ? 0 : Math.max(0, (height - glyphHeight) / 2)) + size * 0.0752 + 0.2, {
    width: box.width, height, align: style.align ?? "center", underline: style.underline, lineGap: 0,
  });
}
function border(pdf: PDFKit.PDFDocument, box: Box, y: number, height: number, fill = "#FFFFFF") {
  pdf.rect(box.x, y, box.width, height).fillAndStroke(fill, "#000000");
}
function cell(pdf: PDFKit.PDFDocument, value: string, box: Box, y: number, height: number, size: number, style: TextStyle = {}) {
  border(pdf, box, y, height);
  const padding = style.align === "left" ? 0.5 : 1.5;
  if (value) text(pdf, value, { x: box.x + padding, width: box.width - padding * 2 }, y + 0.5, height - 1, size, style);
}
function ranges(widths: number[], left = side) {
  const x = [left];
  for (const width of widths) x.push(x.at(-1)! + width);
  return (from: number, to = from): Box => ({ x: x[from], width: x[to + 1] - x[from] });
}
function nip(value: string, doubleSpace = false) {
  return `NIP.${doubleSpace ? "  " : " "}${value.replace(/^(\d{8})(\d{6})(\d)(\d{3})$/, "$1 $2 $3 $4")}`;
}
function nameHeight(pdf: PDFKit.PDFDocument, d: SpjSnapshot, boxes: Box[], size: number, minimum: number) {
  font(pdf, size, true);
  return Math.max(minimum, ...[d.signers.pa, d.signers.pptk, d.signers.treasurer].map((p, i) => pdf.heightOfString(p.name, { width: boxes[i].width - 3 })));
}
function drawAttendance(pdf: PDFKit.PDFDocument, d: SpjSnapshot, workers: SpjSnapshot["workers"], start: number, heights: number[]) {
  const dayCount = d.days.length;
  const col = ranges(attendanceWidths(dayCount)), size = 7.7, row = 9.6;
  const entire = col(0, dayCount + 2), dateArea = col(2, dayCount + 1), note = col(dayCount + 2);
  const period = spjPeriodLabel(d.period);
  ["DAFTAR HADIR JASA TENAGA PELAYANAN UMUM", "PADA SUB KEGIATAN PENYEDIAAN JASA PELAYANAN UMUM KANTOR", "DINAS KETAHANAN PANGAN DAN PERTANIAN KABUPATEN INDRAMAYU", `BULAN :  ${period}`]
    .forEach((value, i) => text(pdf, value, entire, top + i * row, row, size, { bold: true }));
  // Template rows 7-9; C:AF is the 30-day reference, adjusted for the selected month.
  let y = top + 6 * row;
  const header = 13.82, index = 9.5;
  cell(pdf, "NO", col(0), y, header * 2, size);
  cell(pdf, "Nama", col(1), y, header * 2, size);
  cell(pdf, `DAFTAR ABSENSI BULAN ${period.toLocaleUpperCase("id-ID")}`, dateArea, y, header, size);
  cell(pdf, "KET", note, y, header * 2, size);
  d.days.forEach((day, i) => cell(pdf, String(day.day), col(i + 2), y + header, header, size, { bold: true }));
  y += header * 2;
  [col(0), col(1), dateArea, note].forEach((box, i) => cell(pdf, String(i + 1), box, y, index, size));
  y += index;
  workers.forEach((worker, i) => {
    const height = heights[i];
    cell(pdf, String(start + i + 1), col(0), y, height, size);
    cell(pdf, worker.name, col(1), y, height, size, { align: "left" });
    d.days.forEach((day, j) => border(pdf, col(j + 2), y, height, SPJ_CELL_COLORS[day.state]));
    cell(pdf, "", note, y, height, size);
    y += height;
  });
  const left = col(1, 4), middle = col(13, 18), right = col(dayCount - 4, dayCount + 1);
  text(pdf, `Indramayu, ${pltDateLabel(d.documentDate)}`, right, y + 3 * row, row, size);
  const boxes = [left, middle, right], people = [d.signers.pa, d.signers.pptk, d.signers.treasurer];
  ["Pengguna Anggaran", "Pejabat Pelaksana Teknis Kegiatan", "Bendahara Pengeluaran"].forEach((value, i) => text(pdf, value, boxes[i], y + 5 * row, row, size));
  const nameRow = nameHeight(pdf, d, boxes, size, row);
  people.forEach((person, i) => {
    text(pdf, person.name, { x: boxes[i].x + 1.5, width: boxes[i].width - 3 }, y + 10 * row, nameRow, size, { bold: true, underline: true, align: "center" });
    text(pdf, nip(person.nip, i === 1), boxes[i], y + 10 * row + nameRow, row, size);
  });
}
const receiptWidths = [30, 161.63, 8, 58.39, 98.43, 48.8, 48.8, 74.4, 70.43, 74.4, 74.22];
function drawReceipt(pdf: PDFKit.PDFDocument, d: SpjSnapshot, workers: SpjSnapshot["workers"], start: number, heights: number[]) {
  const width = receiptWidths.reduce((a, b) => a + b, 0), left = (pdf.page.width - width) / 2;
  const col = ranges([...receiptWidths, 50.4], left), size = 10, row = 14.5;
  // Original title is A1:L1. The amount is A8:B8, under the payment description.
  text(pdf, "DAFTAR PENERIMAAN JASA TENAGA PELAYANAN UMUM", col(0, 11), top, row, size, { bold: true });
  const total = workers.length * d.activeCount * d.dailyRate;
  const words = terbilangRupiah(total).replace(/\b[a-z]/g, c => c.toUpperCase());
  const valueBox = { x: col(3).x + 2.35, width: col(3, 10).width - 2.35 };
  font(pdf, size);
  const wordsHeight = Math.max(row, pdf.heightOfString(words, { width: valueBox.width })), extra = wordsHeight - row;
  const details: Array<[string, string, number, number]> = [
    ["Telah Terima dari", "Bendahara Pengeluaran Dinas Ketahanan Pangan dan Pertanian Kabupaten Indramayu", top + 2 * row, row],
    ["Uang Sejumlah", words, top + 3 * row, wordsHeight],
    ["Untuk Pembayaran", "Belanja Jasa Tenaga Pelayanan Umum Kantor", top + 4 * row + extra, row],
    ["", "Pada Sub Kegiatan Penyediaan Jasa Pelayanan Umum Kantor", top + 5 * row + extra, row],
    ["", `Bulan ${spjPeriodLabel(d.period)}`, top + 6 * row + extra, row],
  ];
  for (const [label, value, y, height] of details) {
    text(pdf, label, { x: col(0).x + 2, width: col(0, 1).width - 2 }, y + 0.4, height, size, { align: "left", top: height > row });
    text(pdf, ":", { x: col(2).x + 2.35, width: col(2).width }, y + 0.4, height, size, { align: "left", top: height > row });
    text(pdf, value, valueBox, y + 0.4, height, size, { align: "left", top: height > row });
  }
  const amount = col(0, 1), amountY = top + 7 * row + extra;
  text(pdf, "Rp", { x: amount.x + 5.85, width: amount.width - 11.7 }, amountY, row, size, { bold: true, align: "left" });
  text(pdf, money(total), { x: amount.x + 5, width: amount.width - 10 }, amountY, row, size, { bold: true, align: "right" });
  let y = top + 9 * row + extra;
  const tableTop = y;
  pdf.lineWidth(1);
  const groups = [col(0), col(1), col(2, 3), col(4), col(5, 6), col(7), col(8), col(9, 10)];
  const headers = ["No.", "N a m a", "Bank", "No. Rekening", "Volume", "Besarnya\nHonor (Rp)", "Jumlah\nDiterima (Rp)", "Tanda Tangan"];
  const header = 26.75, index = 12.3;
  groups.forEach((box, i) => {
    font(pdf, size);
    const firstLine = headers[i].split("\n")[0];
    const headerSize = Math.min(size, size * (box.width - 3) / pdf.widthOfString(firstLine));
    cell(pdf, headers[i], box, y, header, headerSize);
    cell(pdf, String(i + 1), box, y + header, index, size);
  });
  y += header + index;
  // The reference has continuous body columns, with no horizontal separator between payees.
  const bodyHeight = heights.reduce((a, b) => a + b, 0);
  groups.forEach(box => border(pdf, box, y, bodyHeight));
  workers.forEach((worker, i) => {
    const height = heights[i], textTop = 4.715;
    const data: Array<[string, Box, Align]> = [
      [String(start + i + 1), col(0), "center"], [worker.name, col(1), "left"], [worker.bank, col(3), "center"],
      [worker.accountNumber, col(4), "center"], [String(d.activeCount), col(5), "center"], ["Hari", col(6), "center"],
      [money(d.dailyRate), col(7), "right"], [money(d.dailyRate * d.activeCount), col(8), "right"], [String(start + i + 1), col(9), "left"],
    ];
    for (const [value, box, align] of data) text(pdf, value, { x: box.x + 1.5, width: box.width - 3 }, y + textTop, height - textTop, size, { align, top: true });
    y += height;
  });
  const totalHeight = 25.55;
  border(pdf, col(0, 7), y, totalHeight);
  text(pdf, "J u m l a h", col(0, 5), y, totalHeight, size, { bold: true });
  cell(pdf, money(total), col(8), y, totalHeight, size, { bold: true, align: "right" });
  cell(pdf, "", col(9, 10), y, totalHeight, size);
  y += totalHeight;
  pdf.lineWidth(2).rect(left, tableTop, width, y - tableTop).stroke("#000000").lineWidth(1);
  text(pdf, "Mengetahui / Menyetujui:", col(1, 3), y + 2 * row, row, size);
  text(pdf, "Setuju Dibayar :", col(4, 10), y + 2 * row, row, size);
  // Revised receipt: all PA rows use B:D; PPTK rows E:H, including the NIP directly below the name.
  const boxes = [col(1, 3), col(4, 7), col(8, 10)], people = [d.signers.pa, d.signers.pptk, d.signers.treasurer];
  ["Pengguna Anggaran", "PPTK", "Bendahara Pengeluaran"].forEach((label, i) => text(pdf, label, boxes[i], y + 3 * row, row, size));
  const nameRow = nameHeight(pdf, d, boxes, size, row);
  people.forEach((person, i) => {
    text(pdf, person.name, { x: boxes[i].x + 1.5, width: boxes[i].width - 3 }, y + 8 * row, nameRow, size, { bold: true, underline: true });
    text(pdf, nip(person.nip, i === 1), boxes[i], y + 8 * row + nameRow, row, size);
  });
}
export function spjPdfFilename(d: SpjSnapshot, kind: SpjPdfKind) {
  const type = d.typeName.toLocaleLowerCase("id-ID").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `daftar_${kind === "attendance" ? "hadir" : "penerimaan"}_${type || "tenaga"}_${d.period}.pdf`;
}
export async function createSpjPdf(d: SpjSnapshot, kind: SpjPdfKind) {
  const pdf = new PDFDocument({ size: "A4", layout: "landscape", margin: 0,
    info: { Title: `DAFTAR ${kind === "attendance" ? "HADIR" : "PENERIMAAN"} JASA TENAGA PELAYANAN UMUM`, Author: "DKPP Kabupaten Indramayu" } });
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve, reject) => { pdf.on("end", () => resolve(Buffer.concat(chunks))); pdf.on("error", reject); });
  let start = 0, page = 0;
  while (start < d.workers.length) {
    if (page++) pdf.addPage();
    pdf.lineWidth(0.5).strokeColor("#000000");
    const attendance = kind === "attendance", limit = attendance ? 5 : 3;
    const size = attendance ? 7.7 : 10, width = (attendance ? 68.3 : receiptWidths[1]) - 3;
    font(pdf, size);
    const heights: number[] = [];
    for (let i = start; i < Math.min(start + limit, d.workers.length); i++) {
      const base = attendance ? i === 0 ? 30.9 : 34.91 : i === 0 ? 46.255 : 48.43;
      const worker = d.workers[i];
      const height = Math.max(base, pdf.heightOfString(worker.name, { width }) + 3,
        ...(attendance ? [] : [pdf.heightOfString(worker.bank, { width: receiptWidths[3] - 3 }) + 6,
          pdf.heightOfString(worker.accountNumber, { width: receiptWidths[4] - 3 }) + 6]));
      const budget = attendance ? 230 : 155;
      if (heights.length && heights.reduce((a, b) => a + b, 0) + height > budget) break;
      heights.push(height);
    }
    const workers = d.workers.slice(start, start + heights.length);
    (attendance ? drawAttendance : drawReceipt)(pdf, d, workers, start, heights);
    start += workers.length;
  }
  pdf.end(); return complete;
}
