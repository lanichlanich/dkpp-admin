import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { disciplineSanctions, type DisciplineCase, type DisciplineDocument, type DisciplinePerson } from "@/lib/discipline-case";
import { DisciplineCaseError } from "@/lib/discipline-cases";

const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" });
const dateText = (date: string) => date ? dateFormat.format(new Date(`${date}T00:00:00Z`)) : "";
const dayText = (date: string) => date ? weekday.format(new Date(`${date}T00:00:00Z`)) : "";
const official = (p: DisciplinePerson) => Boolean(p.name && p.nip && p.position);
const sig = (p: DisciplinePerson) => p.name ? `${p.name}\nNIP ${p.nip}\nTanda tangan: ____________________` : "";
const personTags = (key: string, person: DisciplinePerson) => ({
  [`${key}_name`]: person.name || "—",
  [`${key}_nip`]: person.nip || "—",
  [`${key}_rank`]: person.rank || "—",
  [`${key}_position`]: person.position || "—",
});

export async function generateDisciplineDocument(record: DisciplineCase, kind: DisciplineDocument) {
  const { employee, values } = record;
  const { firstCall, secondCall, examiner, authority, review, team, decision } = values;
  const sanction = disciplineSanctions.find(item => item.id === decision.sanction);
  const call = kind === "panggilan-2" ? secondCall : firstCall;
  const isCall = kind === "panggilan-1" || kind === "panggilan-2";
  const teamNeeded = Boolean(team.number) || values.level === "Berat";
  const fullTeam = Boolean(team.number && team.date && official(examiner) && official(team.oversight) && official(team.hr) && official(team.issuer));
  const validDecision = Boolean(sanction && decision.number && decision.date && decision.place && official(authority));
  const missing = (message: string) => { throw new DisciplineCaseError(message, 422); };
  if (isCall && (!call.number || !call.date || !call.letterDate || !call.time || !call.place || !official(examiner)))
    missing("Lengkapi nomor, tanggal surat, jadwal panggilan, dan identitas pemeriksa.");
  if (kind === "panggilan-2" && firstCall.attendance !== "tidak-hadir") missing("Catat ketidakhadiran pada Panggilan I terlebih dahulu.");
  if (kind === "tim" && (!fullTeam || !["Sedang", "Berat"].includes(values.level)))
    missing("Isi tingkat sedang/berat, surat pembentukan, unsur tim, dan PPK atau pejabat yang ditunjuk.");
  if (kind === "bap" && (!review.date || !review.place || !review.questions || !values.provision || !official(examiner)
      || (teamNeeded && !fullTeam) || review.signature === "dua-kali-tidak-hadir"))
    missing("Lengkapi tanggal, pemeriksa, pasal dugaan, dan tanya jawab. Jika memakai tim, isi pembentukan tim terlebih dahulu.");
  if (kind === "laporan" && (!review.reportDate || !review.recipient || !review.recipientPlace || !review.outcome || !review.findings
      || !review.signature || !official(examiner) || !authority.position || (review.outcome === "terbukti" && !review.recommendation)))
    missing("Lengkapi hasil pemeriksaan, tujuan laporan, pejabat yang berwenang, dan rekomendasi bila terbukti.");
  if (kind === "penerimaan" && (!decision.issued || !validDecision || !decision.delivery.date || !decision.delivery.letterDate
      || !decision.delivery.time || !decision.delivery.place || !decision.delivery.recipientPlace))
    missing("Catat keputusan yang telah ditetapkan dan isi jadwal panggilan untuk menerimanya.");
  if (["lisan", "tertulis", "tidak-puas"].includes(kind) &&
      (!validDecision || sanction?.id !== kind || review.outcome !== "terbukti" || !review.signature ||
        !review.findings || !values.provision || !values.incidentDate || !decision.consideration))
    missing("Pilih jenis hukuman yang sesuai format, lalu lengkapi hasil pemeriksaan, pasal, pertimbangan, dan pejabat berwenang.");

  const absence = review.signature === "dua-kali-tidak-hadir";
  const tags = {
    ...personTags("employee", employee), employee_unit: employee.unit || "—",
    ...personTags("examiner", examiner), ...personTags("authority", authority),
    ...personTags("oversight", team.oversight), ...personTags("hr", team.hr),
    ...personTags("issuer", team.issuer), ...personTags("other", team.other),
    city: "Indramayu", allegation: values.allegation, provision: values.provision, level: values.level,
    cc_first: "Inspektorat Kabupaten Indramayu", cc_second: "Kepala BKPSDM Kabupaten Indramayu",
    call_number: call.number, call_date: dateText(call.date), call_day: dayText(call.date), call_letter: dateText(call.letterDate),
    call_time: `${call.time} WIB`, call_place: call.place, call_roman: kind === "panggilan-2" ? "II" : "I",
    team_number: team.number, team_date: dateText(team.date), has_other: Boolean(team.other.name),
    review_date: dateText(review.date), review_day: dayText(review.date), review_place: review.place,
    questions: review.questions, signature_note: review.signature === "menolak" ? "PNS yang diperiksa tidak bersedia menandatangani berita acara pemeriksaan." : "",
    examination_basis: team.number ? `surat pembentukan Tim Pemeriksa Nomor ${team.number}` : "wewenang pemeriksaan sebagai atasan langsung",
    employee_signature: sig(employee),
    bap_signatures: [examiner, team.oversight, team.hr, team.other].map(sig).filter(Boolean).join("\n\n"),
    bap_other: [team.oversight, team.hr, team.other].filter(p => p.name).map((p, i) => `${i + 2}. Nama: ${p.name}\nNIP: ${p.nip}\nPangkat: ${p.rank}\nJabatan: ${p.position}`).join("\n"),
    findings: review.findings, incident_date: dateText(values.incidentDate) || "—", incident_place: values.incidentPlace || "—",
    aggravating: review.aggravating || "—", mitigating: review.mitigating || "—", impact: review.impact || "—",
    report_date: dateText(review.reportDate), recipient: review.recipient, recipient_place: review.recipientPlace,
    report_basis: absence ? "penelaahan alat bukti dan keterangan karena ketidakhadiran pada kedua panggilan dilakukan" : `pemeriksaan telah dilakukan pada ${dayText(review.date)}, ${dateText(review.date)}`,
    report_enclosure: absence ? `Alat bukti dan keterangan yang digunakan: ${review.evidence}` : "Berita acara pemeriksaan disertakan sebagai bahan tindak lanjut.",
    report_conclusion: review.outcome === "terbukti" ? `Pelanggaran disiplin terbukti. Rekomendasi: ${review.recommendation}.` : "Dugaan pelanggaran disiplin tidak terbukti.",
    decision_finding: `berdasarkan ${absence ? "alat bukti dan keterangan setelah dua panggilan tidak dihadiri" : "hasil pemeriksaan"}, ${employee.name}, NIP ${employee.nip}, terbukti melakukan perbuatan berupa ${review.findings}`,
    decision_date: dateText(decision.date), decision_number: decision.number, decision_place: decision.place,
    sanction: sanction?.label ?? "", consideration: decision.consideration,
    extra_basis: decision.extraBasis || "Peraturan Pemerintah Nomor 79 Tahun 2021 tentang Upaya Administratif dan Badan Pertimbangan Aparatur Sipil Negara",
    asn_law: decision.date < "2023-10-31" ? "Undang-Undang Nomor 5 Tahun 2014 tentang Aparatur Sipil Negara" : "Undang-Undang Nomor 20 Tahun 2023 tentang Aparatur Sipil Negara",
    delivery_letter: dateText(decision.delivery.letterDate), delivery_date: dateText(decision.delivery.date), delivery_day: dayText(decision.delivery.date),
    delivery_time: `${decision.delivery.time} WIB`, delivery_place: decision.delivery.place, delivery_address: decision.delivery.recipientPlace,
  };
  const template = isCall ? "panggilan" : kind;
  const zip = new PizZip(await readFile(path.join(process.cwd(), "src", "templates", "penjatuhan-hukdis", `${template}.docx`)));
  const document = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter(part) { throw new Error(`Tag format tidak diisi: ${part.value}`); } });
  document.render(tags);
  const label = values.reference.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 65);
  return {
    fileName: `Draf-${kind}-${label}.docx`,
    bytes: document.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }),
  };
}
