import "server-only";

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function generateKgbDocument(data: Record<string, string | number>) {
  const templatePath = path.join(process.cwd(), "src", "templates", "template-kgb.docx");
  const template = await readFile(templatePath);
  const zip = new PizZip(template);
  // New forms send the full classified number. Remove only the old template's
  // fixed prefix/suffix while retaining the surrounding runs and formatting.
  if (String(data.nomor_surat).includes("/")) {
    const xml = zip.file("word/document.xml")!.asText();
    let replaced = false;
    const updated = xml.replace(/<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => {
      if (!paragraph.includes("nomor_surat")) return paragraph;
      if (!paragraph.includes("800.1.11.13/")) throw new Error("KGB letter-number template is not recognized.");
      replaced = true;
      return paragraph.replace(/(<w:t(?:\s[^>]*)?>)800\.1\.11\.13\/(<\/w:t>)/, "$1$2")
        .replace(/(<w:t(?:\s[^>]*)?>)(?:-|Sekre)(<\/w:t>)/g, "$1$2");
    });
    if (!replaced) throw new Error("KGB letter-number placeholder is missing.");
    zip.file("word/document.xml", updated);
  }
  const document = new Docxtemplater(zip, {
    delimiters: { start: "<<", end: ">>" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  document.render(data);
  return document.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}
