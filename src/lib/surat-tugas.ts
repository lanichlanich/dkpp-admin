import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { database } from "@/lib/database";
import { formatIndonesianDate } from "@/lib/kgb";
import { signatoryRank } from "@/lib/signatory";
import { TUGAS_TITLE, TUGAS_SIGNER, type SuratTugasInput, type TugasEmployee } from "@/lib/surat-tugas-validation";

export async function tugasEmployees() {
  return database.prepare("SELECT nip, name, rank, position, unit FROM employees WHERE status = 'Aktif' ORDER BY name COLLATE NOCASE").all<TugasEmployee>();
}
export async function tugasPeople(nips: string[]) {
  const rows = await database.prepare(`SELECT nip, name, rank, position, unit FROM employees WHERE status = 'Aktif' AND nip IN (${nips.map(() => "?").join(",")})`).all<TugasEmployee>(...nips);
  const byNip = new Map(rows.map(row => [row.nip, row]));
  const employees = nips.map(nip => byNip.get(nip)).filter((row): row is TugasEmployee => !!row);
  const signers = await database.prepare("SELECT nip, rank FROM employees WHERE status = 'Aktif' AND UPPER(name) LIKE 'RORY FIRMANSYAH%' AND (LENGTH(TRIM(name)) = 15 OR SUBSTR(UPPER(TRIM(name)), 16, 1) IN (',', ' '))").all<Pick<TugasEmployee, "nip" | "rank">>();
  const signer = signers.length === 1 && /^\d{18}$/.test(signers[0].nip) && signatoryRank(signers[0].rank).name ? signers[0] : null;
  return { employees, signer };
}

const esc = (value: string) => value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]!);
type ParagraphOptions = { center?: boolean; bold?: boolean; underline?: boolean; keep?: boolean; indent?: number; hanging?: number; before?: number; tabs?: number[]; size?: number };
function para(value: string | string[], opts: ParagraphOptions = {}) {
  const text = (Array.isArray(value) ? value : [value]).map(part => `<w:t xml:space="preserve">${esc(part)}</w:t>`).join("<w:tab/>");
  return `<w:p><w:pPr>${opts.keep ? "<w:keepNext/>" : ""}<w:keepLines/>${opts.tabs ? `<w:tabs>${opts.tabs.map(pos => `<w:tab w:val="left" w:pos="${pos}"/>`).join("")}</w:tabs>` : ""}<w:spacing w:after="25" w:line="250" w:lineRule="auto"${opts.before ? ` w:before="${opts.before}"` : ""}/>${opts.indent ? `<w:ind w:left="${opts.indent}"${opts.hanging ? ` w:hanging="${opts.hanging}"` : ""}/>` : ""}${opts.center ? '<w:jc w:val="center"/>' : ""}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${opts.bold ? "<w:b/>" : ""}<w:sz w:val="${opts.size ?? 22}"/>${opts.underline ? '<w:u w:val="single"/>' : ""}</w:rPr>${text}</w:r></w:p>`;
}
export async function renderSuratTugas(values: SuratTugasInput, employees: TugasEmployee[], signer: Pick<TugasEmployee,"nip"|"rank">) {
  const zip = new PizZip(await readFile(path.join(process.cwd(), "src/templates/template-surat-tugas.docx")));
  const document = zip.file("word/document.xml");
  if (!document) throw new Error("Template Surat Tugas rusak.");
  const list = (label: string, items: string[], alwaysNumber: boolean) => items.map((item, i) => {
    const showNumber = alwaysNumber || items.length > 1;
    const indent = showNumber ? 1620 : 1280;
    return para([i === 0 ? label : "", i === 0 ? ":" : "", ...(showNumber ? [`${i + 1}.`] : []), item], { indent, hanging: indent, tabs: showNumber ? [1010, 1280, 1620] : [1010, 1280], before: i === 0 ? 260 : 20 });
  });
  const body = [
    para("SURAT TUGAS", { center: true, bold: true, underline: true, keep: true, before: 150, size: 26 }),
    para(`Nomor : ${values.nomor}`, { center: true, keep: true, before: 125, size: 24 }),
    ...list("Dasar", values.dasar, false),
    para("M E M E R I N T A H K A N", { center: true, bold: true, keep: true, before: 260 }),
    ...employees.flatMap((person, i) => [
      para([i ? "" : "Kepada", i ? "" : ":", `${i + 1}.`, "Nama", ":", person.name], { indent: 3700, hanging: 3700, tabs: [1010, 1280, 1870, 3440, 3700], keep: true, before: i ? 200 : 235 }),
      ...[["NIP", person.nip], ["Unit Kerja", person.unit || "–"], ["Jabatan", person.position || "–"]].map(([label, value], index) => para(["", label, ":", value], { indent: 3700, hanging: 3700, tabs: [1870, 3440, 3700], keep: index < 2 })),
    ]),
    ...list("Untuk", values.tugas, true),
  ].join("");
  const signature = [
    para(["", "Dikeluarkan di", ":", values.tempat], { indent: 6120, hanging: 6120, tabs: [4510, 5850, 6120], keep: true, before: 245 }),
    para(["", "Pada Tanggal", ":", formatIndonesianDate(values.tanggal)], { indent: 6120, hanging: 6120, tabs: [4510, 5850, 6120], keep: true }),
    para(TUGAS_TITLE, { indent: 4510, keep: true, before: 180 }),
    para("${ttd_pengirim}", { indent: 4510, keep: true, before: 200 }),
    para(TUGAS_SIGNER, { indent: 4510, bold: true, keep: true, before: 250 }),
    para(signatoryRank(signer.rank).name, { indent: 4510, keep: true }),
    para(`NIP. ${signer.nip}`, { indent: 4510 }),
  ].join("");
  const marker = /<w:p(?:\s[^>]*)?>((?:(?!<\/w:p>)[\s\S])*?)<w:t(?:\s[^>]*)?>\[\[BODY\]\]<\/w:t>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/;
  const xml = document.asText();
  const signatureTable = /<w:tbl>(?:(?!<\/w:tbl>)[\s\S])*?\$\{ttd_pengirim\}(?:(?!<\/w:tbl>)[\s\S])*?<\/w:tbl>/;
  if (!marker.test(xml) || !signatureTable.test(xml)) throw new Error("Penanda template Surat Tugas tidak lengkap.");
  zip.file("word/document.xml", xml.replace(signatureTable, () => signature).replace(marker, () => body));
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
