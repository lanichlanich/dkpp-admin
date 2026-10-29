import "server-only";
import PDFDocument from "pdfkit";
import path from "node:path";
import { LIBRARY_CARDS_PER_PAGE, type LibraryCardVisitor } from "@/lib/library-types";

// ISO ID-1: 85.6 x 54 mm. The same artwork is used for single and batch downloads.
const width = 242.65, height = 153.07;
function document(size: PDFKit.PDFDocumentOptions["size"], title: string) {
  const pdf = new PDFDocument({ size, margin: 0, info: { Title: title, Author: "Perpustakaan DKPP Kabupaten Indramayu" } });
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve,reject) => { pdf.on("end", () => resolve(Buffer.concat(chunks))); pdf.on("error",reject); });
  return { pdf, complete };
}
function drawCard(pdf: PDFKit.PDFDocument, visitor: LibraryCardVisitor, x: number, y: number) {
  pdf.save().translate(x, y);
  pdf.rect(0,0,width,height).fill("#F5F8F4");
  pdf.rect(0,0,width,43).fill("#064E3B");
  pdf.image(path.join(process.cwd(),"public","dkpp-admin-logo.png"),10,7,{fit:[28,28]});
  pdf.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(10).text("PERPUSTAKAAN DKPP",45,10,{width:185,lineBreak:false});
  pdf.font("Helvetica").fontSize(7).text("Kabupaten Indramayu",45,25,{width:185,lineBreak:false});
  pdf.fillColor("#047857").font("Helvetica-Bold").fontSize(7).text("KARTU PENGUNJUNG",12,53,{width:218,lineBreak:false});
  // Fit long identities without truncating their visible name or organization.
  const fit = (text: string, y: number, maxHeight: number, bold: boolean, initial: number) => {
    let size = initial; pdf.font(bold?"Helvetica-Bold":"Helvetica");
    while (size > 4.5) { pdf.fontSize(size); if (pdf.heightOfString(text,{width:218}) <= maxHeight) break; size -= 0.25; }
    pdf.fontSize(size).text(text,12,y,{width:218,height:maxHeight});
  };
  pdf.fillColor("#111827"); fit(visitor.name,67,26,true,11);
  pdf.fillColor("#52525B"); fit(visitor.organization || "Pengunjung umum",96,18,false,7);
  pdf.fillColor("#064E3B").font("Helvetica-Bold").fontSize(8).text(visitor.cardNumber,12,120,{width:218,lineBreak:false});
  pdf.fillColor("#71717A").font("Helvetica").fontSize(5.5).text("Bawa kartu ini saat berkunjung dan meminjam buku.",12,138,{width:218,lineBreak:false});
  pdf.restore();
}
export async function createLibraryCard(visitor: LibraryCardVisitor) {
  const { pdf, complete } = document([width, height], `Kartu Pengunjung ${visitor.cardNumber}`);
  drawCard(pdf, visitor, 0, 0);
  pdf.end(); return complete;
}
export async function createLibraryCards(visitors: LibraryCardVisitor[]) {
  if (!visitors.length) throw new Error("Pilih minimal satu pengunjung.");
  const { pdf, complete } = document("A4", "Kartu Pengunjung Terpilih - Perpustakaan DKPP");
  const pages = Math.ceil(visitors.length / LIBRARY_CARDS_PER_PAGE);
  const gap = 28.35; // 10 mm between cards, preserving the physical card size.
  for (let page = 0; page < pages; page++) {
    if (page) pdf.addPage();
    const pageWidth = pdf.page.width, pageHeight = pdf.page.height;
    const left = (pageWidth - 2 * width - gap) / 2;
    const top = (pageHeight - 3 * height - 2 * gap) / 2;
    pdf.fillColor("#064E3B").font("Helvetica-Bold").fontSize(14).text("KARTU PENGUNJUNG", 40, 44, { width: pageWidth - 80, align: "center", lineBreak: false });
    pdf.fillColor("#52525B").font("Helvetica").fontSize(10).text("Perpustakaan DKPP Kabupaten Indramayu", 40, 65, { width: pageWidth - 80, align: "center", lineBreak: false });
    visitors.slice(page * LIBRARY_CARDS_PER_PAGE, (page + 1) * LIBRARY_CARDS_PER_PAGE).forEach((visitor, index) => {
      const x = left + (index % 2) * (width + gap), y = top + Math.floor(index / 2) * (height + gap);
      drawCard(pdf, visitor, x, y);
      pdf.save().lineWidth(0.4).strokeColor("#94A3B8").dash(2, { space: 2 }).rect(x - 2, y - 2, width + 4, height + 4).stroke().restore();
    });
    pdf.fillColor("#52525B").font("Helvetica").fontSize(8).text("Cetak A4 pada ukuran asli (100%). Potong mengikuti garis putus-putus.", 40, pageHeight - 54, { width: pageWidth - 80, align: "center", lineBreak: false });
    pdf.text(`Halaman ${page + 1} / ${pages}`, 40, pageHeight - 38, { width: pageWidth - 80, align: "center", lineBreak: false });
  }
  pdf.end(); return complete;
}
