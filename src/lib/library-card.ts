import "server-only";
import PDFDocument from "pdfkit";
import path from "node:path";
import type { LibraryVisitor } from "@/lib/library-types";

export async function createLibraryCard(visitor: LibraryVisitor) {
  // Actual ISO ID-1 card size (85.6 x 54 mm); a single printable PDF page.
  const width = 242.65, height = 153.07;
  const pdf = new PDFDocument({ size: [width, height], margin: 0, info: { Title: `Kartu Pengunjung ${visitor.cardNumber}`, Author: "Perpustakaan DKPP Kabupaten Indramayu" } });
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve,reject) => { pdf.on("end", () => resolve(Buffer.concat(chunks))); pdf.on("error",reject); });
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
  pdf.end(); return complete;
}
