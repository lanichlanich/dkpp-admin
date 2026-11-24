import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { database } from "@/lib/database";
import { formatIndonesianDate } from "@/lib/kgb";
import { signatoryRank } from "@/lib/signatory";
import { TUGAS_TITLE, TUGAS_SIGNER, type SuratTugasInput, type TugasEmployee } from "@/lib/surat-tugas-validation";

export async function tugasEmployees() {
  return database.prepare("SELECT nip, name, rank, position FROM employees WHERE status = 'Aktif' ORDER BY name COLLATE NOCASE").all<TugasEmployee>();
}
export async function tugasPeople(nips: string[]) {
  const rows = await database.prepare(`SELECT nip, name, rank, position FROM employees WHERE status = 'Aktif' AND nip IN (${nips.map(() => "?").join(",")})`).all<TugasEmployee>(...nips);
  const byNip = new Map(rows.map(row => [row.nip, row]));
  const employees = nips.map(nip => byNip.get(nip)).filter((row): row is TugasEmployee => !!row);
  const signers = await database.prepare("SELECT nip, rank FROM employees WHERE status = 'Aktif' AND UPPER(name) LIKE 'RORY FIRMANSYAH%' AND (LENGTH(TRIM(name)) = 15 OR SUBSTR(UPPER(TRIM(name)), 16, 1) IN (',', ' '))").all<Pick<TugasEmployee, "nip" | "rank">>();
  const signer = signers.length === 1 && /^\d{18}$/.test(signers[0].nip) && signatoryRank(signers[0].rank).name ? signers[0] : null;
  return { employees, signer };
}

const esc = (value: string) => value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]!);
function para(value: string, opts: { center?: boolean; bold?: boolean; keep?: boolean; indent?: number; hanging?: number; before?: number } = {}) {
  return `<w:p><w:pPr>${opts.keep ? "<w:keepNext/>" : ""}<w:keepLines/><w:spacing w:after="65" w:line="250" w:lineRule="auto"${opts.before ? ` w:before="${opts.before}"` : ""}/>${opts.indent ? `<w:ind w:left="${opts.indent}"${opts.hanging ? ` w:hanging="${opts.hanging}"` : ""}/>` : ""}${opts.center ? '<w:jc w:val="center"/>' : ""}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Bookman Old Style" w:hAnsi="Bookman Old Style"/><w:sz w:val="24"/>${opts.bold ? "<w:b/>" : ""}</w:rPr><w:t xml:space="preserve">${esc(value)}</w:t></w:r></w:p>`;
}
export async function renderSuratTugas(values: SuratTugasInput, employees: TugasEmployee[], signer: Pick<TugasEmployee,"nip"|"rank">) {
  const zip = new PizZip(await readFile(path.join(process.cwd(), "src/templates/template-surat-tugas.docx")));
  const document = zip.file("word/document.xml");
  if (!document) throw new Error("Template Surat Tugas rusak.");
  const list = (label: string, items: string[]) => [para(label, { bold: true, keep: true, before: 120 }), ...items.map((item, i) => para(`${i + 1}.  ${item}`, { indent: 600, hanging: 300 }))];
  const body = [
    para("SURAT TUGAS", { center: true, bold: true, keep: true, before: 200 }),
    para(`NOMOR ${values.nomor}`, { center: true, keep: true }),
    ...list("Dasar :", values.dasar),
    para("MEMERINTAHKAN:", { center: true, bold: true, keep: true, before: 120 }),
    para("Kepada :", { bold: true, keep: true }),
    ...employees.flatMap((person, i) => [
      para(`${i + 1}.  Nama : ${person.name}`, { indent: 600, hanging: 300, keep: true, before: i ? 85 : 0 }),
      para(`Pangkat/Golongan : ${signatoryRank(person.rank).full || "-"}`, { indent: 600, keep: true }),
      para(`NIP : ${person.nip}`, { indent: 600, keep: true }),
      para(`Jabatan : ${person.position || "-"}`, { indent: 600 }),
    ]),
    ...list("Untuk :", values.tugas),
    para(`${values.tempat}, ${formatIndonesianDate(values.tanggal)}`, { indent: 4200, keep: true, before: 150 }),
  ].join("");
  const tokens = { TITLE: TUGAS_TITLE, SIGNER: TUGAS_SIGNER, RANK: signatoryRank(signer.rank).name, NIP: `NIP. ${signer.nip}` };
  const marker = /<w:p(?:\s[^>]*)?>((?:(?!<\/w:p>)[\s\S])*?)<w:t(?:\s[^>]*)?>\[\[BODY\]\]<\/w:t>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/;
  const xml = document.asText();
  if (!marker.test(xml) || !Object.keys(tokens).every(key => xml.includes(`[[${key}]]`)) || !xml.includes("${ttd_pengirim}")) throw new Error("Penanda template Surat Tugas tidak lengkap.");
  zip.file("word/document.xml", xml.replace(/\[\[(TITLE|SIGNER|RANK|NIP)\]\]/g, (_, key: keyof typeof tokens) => esc(tokens[key])).replace(marker, () => body));
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
