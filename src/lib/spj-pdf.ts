import "server-only";
import PDFDocument from "pdfkit";
import { terbilangRupiah } from "@/lib/kgb";
import { pltDateLabel } from "@/lib/plt-dates";
import { spjPeriodLabel } from "@/lib/spj-calendar";
import type { SpjSnapshot } from "@/lib/spj-types";

export type SpjPdfKind = "attendance" | "receipt";
export const SPJ_CELL_COLORS = { active: "#FFFFFF", holiday: "#C00000", inactive: "#595959" };
const margin = 28;
const money = (value: number) => value.toLocaleString("id-ID");
function text(pdf: PDFKit.PDFDocument, value: string, x: number, y: number, width: number, height: number, size = 9, bold = false, align: "left" | "center" | "right" = "center") {
  pdf.fillColor("#000000").font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
  while (size > 7 && pdf.heightOfString(value, { width, lineGap: 1 }) > height) pdf.fontSize(--size);
  pdf.text(value, x, y, { width, height, align, lineGap: 1 });
}
function cell(pdf: PDFKit.PDFDocument, value: string, x: number, y: number, width: number, height: number, options: { fill?: string; bold?: boolean; align?: "left" | "center" | "right"; size?: number } = {}) {
  pdf.rect(x, y, width, height).fillAndStroke(options.fill ?? "#FFFFFF", "#000000");
  if (value) {
    const fontSize = options.size ?? 9;
    pdf.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
    const h = Math.min(pdf.heightOfString(value, { width: width - 6, lineGap: 1 }), height - 6);
    text(pdf, value, x + 3, y + Math.max(3, (height - h) / 2), width - 6, height - 6, fontSize, options.bold, options.align);
  }
}
function signatures(pdf: PDFKit.PDFDocument, d: SpjSnapshot, y: number, payment = false) {
  const width = pdf.page.width - margin * 2, col = width / 3;
  text(pdf, `Indramayu, ${pltDateLabel(d.documentDate)}`, margin + col * 2, y, col, 18, 9);
  if (payment) {
    text(pdf, "Mengetahui / Menyetujui:", margin + 5, y, col - 10, 18, 9);
    text(pdf, "Setuju Dibayar:", margin + col + 5, y, col - 10, 18, 9);
  }
  const people = [d.signers.pa, d.signers.pptk, d.signers.treasurer];
  const roles = ["Pengguna Anggaran", "Pejabat Pelaksana Teknis Kegiatan", "Bendahara Pengeluaran"];
  people.forEach((person, i) => {
    const x = margin + i * col + 5, w = col - 10;
    text(pdf, roles[i], x, y + 23, w, 24, 9);
    if (i === 0) text(pdf, `${d.signers.pa.status === "plt" ? "Plt. " : ""}${person.position.replace(/^Plt\.?\s*/i, "")}`, x, y + 42, w, 30, 8);
    text(pdf, person.name, x, y + 94, w, 28, 9, true);
    const nip = person.nip.replace(/^(\d{8})(\d{6})(\d)(\d{3})$/, "$1 $2 $3 $4");
    text(pdf, `NIP. ${nip}`, x, y + 125, w, 14, 8);
  });
}
function attendance(pdf: PDFKit.PDFDocument, d: SpjSnapshot, start: number, limit: number) {
  const width = pdf.page.width - margin * 2, period = spjPeriodLabel(d.period);
  ["DAFTAR HADIR JASA TENAGA PELAYANAN UMUM", "PADA SUB KEGIATAN PENYEDIAAN JASA PELAYANAN UMUM KANTOR", "DINAS KETAHANAN PANGAN DAN PERTANIAN KABUPATEN INDRAMAYU", `BULAN: ${period.toLocaleUpperCase("id-ID")}`]
    .forEach((line, i) => text(pdf, line, margin, 25 + i * 16, width, 16, 10.5, true));
  text(pdf, d.typeName, margin, 92, width, 14, 9);
  const top = 114, no = 24, name = 148, note = 49, dayWidth = (width - no - name - note) / d.days.length;
  const daysX = margin + no + name;
  cell(pdf, "NO", margin, top, no, 38, { size: 8 });
  cell(pdf, "Nama", margin + no, top, name, 38);
  cell(pdf, `DAFTAR ABSENSI BULAN ${period.toLocaleUpperCase("id-ID")}`, daysX, top, dayWidth * d.days.length, 20, { size: 9 });
  cell(pdf, "KET", margin + width - note, top, note, 38, { size: 8 });
  d.days.forEach((day, i) => cell(pdf, String(day.day), daysX + i * dayWidth, top + 20, dayWidth, 18, { size: 8, bold: true }));
  cell(pdf, "1", margin, top + 38, no, 14, { size: 7 });
  cell(pdf, "2", margin + no, top + 38, name, 14, { size: 7 });
  cell(pdf, "3", daysX, top + 38, dayWidth * d.days.length, 14, { size: 7 });
  cell(pdf, "4", margin + width - note, top + 38, note, 14, { size: 7 });
  let y = top + 52;
  d.workers.slice(start, start + limit).forEach((worker, index) => {
    cell(pdf, String(start + index + 1), margin, y, no, 40);
    cell(pdf, worker.name, margin + no, y, name, 40, { align: "left" });
    d.days.forEach((day, i) => cell(pdf, "", daysX + i * dayWidth, y, dayWidth, 40, { fill: SPJ_CELL_COLORS[day.state] }));
    cell(pdf, `${d.activeCount} hari`, margin + width - note, y, note, 40, { size: 8 });
    y += 40;
  });
  let x = margin;
  for (const [fill, label] of [[SPJ_CELL_COLORS.active, "Hari aktif"], [SPJ_CELL_COLORS.holiday, "Sabtu/Minggu atau libur nasional"], [SPJ_CELL_COLORS.inactive, "Hari nonaktif"]]) {
    pdf.rect(x, y + 10, 10, 10).fillAndStroke(fill, "#000000");
    text(pdf, label, x + 15, y + 10, 205, 12, 7.5, false, "left");
    x += label.length > 15 ? 235 : 105;
  }
  signatures(pdf, d, y + 30);
}
function receipt(pdf: PDFKit.PDFDocument, d: SpjSnapshot, start: number, limit: number) {
  const width = pdf.page.width - margin * 2;
  text(pdf, "DAFTAR PENERIMAAN JASA TENAGA PELAYANAN UMUM", margin, 25, width, 18, 11, true);
  text(pdf, d.typeName, margin, 46, width, 16, 9);
  const details: Array<[string, string, number, number]> = [
    ["Telah Terima dari", "Bendahara Pengeluaran Dinas Ketahanan Pangan dan Pertanian Kabupaten Indramayu", 69, 15],
    ["Uang Sejumlah", terbilangRupiah(d.total).replace(/^./, c => c.toUpperCase()), 88, 29],
    ["Untuk Pembayaran", "Belanja Jasa Tenaga Pelayanan Umum Kantor", 121, 15],
    ["", "Pada Sub Kegiatan Penyediaan Jasa Pelayanan Umum Kantor", 137, 15],
    ["", `Bulan ${spjPeriodLabel(d.period)}`, 153, 15],
  ];
  for (const [label, value, y, h] of details) {
    text(pdf, label, margin, y, 110, h, 9, false, "left");
    text(pdf, ":", margin + 110, y, 10, h, 9);
    text(pdf, value, margin + 125, y, width - 125, h, 9, false, "left");
  }
  text(pdf, `Rp${money(d.total)}`, margin + width - 175, 152, 175, 17, 10, true, "right");
  const sizes = [24, 155, 40, 100, 55, 95, 110, width - 579];
  const headers = ["No.", "Nama", "Bank", "No. Rekening", "Volume", "Besarnya Honor\n(Rp/hari)", "Jumlah Diterima\n(Rp)", "Tanda Tangan"];
  let x = margin, y = 177;
  headers.forEach((header, i) => { cell(pdf, header, x, y, sizes[i], 32, { size: 8 }); cell(pdf, String(i + 1), x, y + 32, sizes[i], 14, { size: 7 }); x += sizes[i]; });
  y += 46;
  const workers = d.workers.slice(start, start + limit);
  workers.forEach((worker, i) => {
    const values = [String(start + i + 1), worker.name, worker.bank || "-", worker.accountNumber || "-", `${d.activeCount} Hari`, money(d.dailyRate), money(d.dailyRate * d.activeCount), `${start + i + 1}.`];
    x = margin;
    values.forEach((value, col) => { cell(pdf, value, x, y, sizes[col], 40, { size: col === 3 ? 8 : 9, align: col === 1 || col === 7 ? "left" : col === 5 || col === 6 ? "right" : "center" }); x += sizes[col]; });
    y += 40;
  });
  const left = sizes.slice(0, 6).reduce((a, b) => a + b, 0);
  cell(pdf, d.workers.length > limit ? "Jumlah halaman ini" : "Jumlah", margin, y, left, 22, { bold: true });
  cell(pdf, money(workers.length * d.activeCount * d.dailyRate), margin + left, y, sizes[6], 22, { bold: true, align: "right" });
  cell(pdf, "", margin + left + sizes[6], y, sizes[7], 22);
  signatures(pdf, d, y + 39, true);
}
export function spjPdfFilename(d: SpjSnapshot, kind: SpjPdfKind) {
  const type = d.typeName.toLocaleLowerCase("id-ID").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `daftar_${kind === "attendance" ? "hadir" : "penerimaan"}_${type || "tenaga"}_${d.period}.pdf`;
}
export async function createSpjPdf(d: SpjSnapshot, kind: SpjPdfKind) {
  const pdf = new PDFDocument({ size: "A4", layout: "landscape", margin: 0, bufferPages: false,
    info: { Title: `Daftar ${kind === "attendance" ? "Hadir" : "Penerimaan"} ${d.typeName} ${spjPeriodLabel(d.period)}`, Author: "DKPP Kabupaten Indramayu" } });
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve, reject) => { pdf.on("end", () => resolve(Buffer.concat(chunks))); pdf.on("error", reject); });
  const limit = kind === "attendance" ? 5 : 4, pages = Math.ceil(d.workers.length / limit);
  for (let page = 0; page < pages; page++) {
    if (page) pdf.addPage();
    pdf.lineWidth(0.5).strokeColor("#000000");
    (kind === "attendance" ? attendance : receipt)(pdf, d, page * limit, limit);
    text(pdf, `Halaman ${page + 1} dari ${pages}`, margin, pdf.page.height - 19, pdf.page.width - margin * 2, 12, 7, false, "right");
  }
  pdf.end(); return complete;
}
