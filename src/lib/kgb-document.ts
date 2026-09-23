import "server-only";

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function generateKgbDocument(data: Record<string, string | number>) {
  const templatePath = path.join(process.cwd(), "src", "templates", "template-kgb.docx");
  const template = await readFile(templatePath);
  const zip = new PizZip(template);
  const document = new Docxtemplater(zip, {
    delimiters: { start: "<<", end: ">>" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  document.render(data);
  return document.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}
