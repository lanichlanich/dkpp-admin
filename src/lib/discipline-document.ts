import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { getDisciplineExaminations, type DisciplineCase, type DisciplineDocument, type DisciplinePerson } from "@/lib/discipline-case";
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
  const { firstCall, secondCall, examiner, review, team } = values;
  const isAttendanceCase = values.absenceDays !== undefined;
  const second = kind === "panggilan-2";
  const call = second ? secondCall : firstCall;
  const isCall = kind === "panggilan-1" || second;
  const isBap = kind === "bap" || kind === "bap-1" || kind === "bap-2";
  const sessions = getDisciplineExaminations(values);
  const session = kind === "bap-1" ? sessions.firstCall : kind === "bap-2" ? sessions.secondCall : sessions.secondCall ?? sessions.firstCall;
  const reportedDates = Object.values(sessions).flatMap(item => item?.signature && item.date && item.questions ? [item.date] : []).sort();
  const evidenceOnly = review.signature === "dua-kali-tidak-hadir";
  const teamNeeded = Boolean(team.number) || values.level === "Berat";
  const fullTeam = Boolean(team.number && team.date && official(examiner) && official(team.oversight) && official(team.hr) && official(team.issuer));
  const missing = (message: string) => { throw new DisciplineCaseError(message, 422); };
  if (isCall && (!call.number || !call.date || !call.letterDate || !call.time || !call.place || !official(examiner)))
    missing("Lengkapi nomor, tanggal surat, jadwal panggilan, dan identitas pemeriksa.");
  if (second && !firstCall.date) missing("Catat jadwal Panggilan I terlebih dahulu.");
  if (kind === "tim" && (!fullTeam || !["Sedang", "Berat"].includes(values.level)))
    missing("Isi tingkat sedang/berat, surat pembentukan, unsur tim, dan PPK atau pejabat yang ditunjuk.");
  if (isBap && (!session?.date || !session.place || !session.questions || !values.provision || !official(examiner)
      || (teamNeeded && !fullTeam) || evidenceOnly))
    missing("Lengkapi tanggal, tempat, pemeriksa, pasal dugaan, dan tanya jawab untuk panggilan yang dipilih. Jika memakai tim, isi pembentukan tim terlebih dahulu.");
  if (kind === "laporan" && (!review.reportDate || !review.recipient || !review.recipientPlace || !review.outcome || !review.findings
      || (!evidenceOnly && !reportedDates.length) || !official(examiner) || (review.outcome === "terbukti" && !review.recommendation)))
    missing("Lengkapi BAP atau telaah bukti, hasil pemeriksaan, tujuan laporan, dan rekomendasi bila terbukti.");

  const reportDates = [...new Set(reportedDates)].map(date => `${dayText(date)}, ${dateText(date)}`).join(" dan ");
  const callTitle = second ? (firstCall.attendance === "hadir" ? "II (PEMERIKSAAN LANJUTAN)" : "II") : "I";
  const tags = {
    ...personTags("employee", employee), employee_unit: employee.unit || "—",
    ...personTags("examiner", examiner),
    ...personTags("oversight", team.oversight), ...personTags("hr", team.hr),
    ...personTags("issuer", team.issuer), ...personTags("other", team.other),
    city: "Indramayu", allegation: values.allegation, provision: values.provision, level: values.level,
    cc_first: "Inspektorat Kabupaten Indramayu", cc_second: "Kepala BKPSDM Kabupaten Indramayu",
    call_number: call.number, call_date: dateText(call.date), call_day: dayText(call.date), call_letter: dateText(call.letterDate),
    call_time: `${call.time} WIB`, call_place: call.place, call_roman: callTitle,
    team_number: team.number, team_date: dateText(team.date), has_other: Boolean(team.other.name),
    review_date: dateText(session?.date ?? ""), review_day: dayText(session?.date ?? ""), review_place: session?.place ?? "",
    questions: session?.questions ?? "", signature_note: session?.signature === "menolak" ? "PNS yang diperiksa tidak bersedia menandatangani berita acara pemeriksaan." : "",
    examination_basis: team.number ? `surat pembentukan Tim Pemeriksa Nomor ${team.number}` : "wewenang pemeriksaan sebagai atasan langsung",
    employee_signature: sig(employee),
    bap_signatures: [examiner, team.oversight, team.hr, team.other].map(sig).filter(Boolean).join("\n\n"),
    bap_other: [team.oversight, team.hr, team.other].filter(p => p.name).map((p, i) => `${i + 2}. Nama: ${p.name}\nNIP: ${p.nip}\nPangkat: ${p.rank}\nJabatan: ${p.position}`).join("\n"),
    findings: review.findings,
    incident_date_heading: isAttendanceCase ? "HARI" : "WAKTU",
    incident_place_heading: isAttendanceCase ? "POLA" : "TEMPAT",
    incident_date: isAttendanceCase ? `${values.absenceDays} hari kerja` : dateText(values.incidentDate) || "—",
    incident_place: isAttendanceCase ? (values.consecutiveAbsence ? "Min. 10 hari beruntun" : "Kumulatif") : values.incidentPlace || "—",
    aggravating: review.aggravating || "—", mitigating: review.mitigating || "—", impact: review.impact || "—",
    report_date: dateText(review.reportDate), recipient: review.recipient, recipient_place: review.recipientPlace,
    report_basis: evidenceOnly ? "penelaahan alat bukti dan keterangan karena ketidakhadiran pada kedua panggilan dilakukan" : `pemeriksaan telah dilakukan pada ${reportDates}`,
    report_enclosure: evidenceOnly ? `Alat bukti dan keterangan yang digunakan: ${review.evidence}` : "Berita acara pemeriksaan disertakan sebagai bahan tindak lanjut.",
    report_conclusion: review.outcome === "terbukti" ? `Pelanggaran disiplin terbukti. Rekomendasi: ${review.recommendation}.` : "Dugaan pelanggaran disiplin tidak terbukti.",
  };
  const template = isCall ? "panggilan" : isBap ? "bap" : kind;
  const zip = new PizZip(await readFile(path.join(process.cwd(), "src", "templates", "penjatuhan-hukdis", `${template}.docx`)));
  const document = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter(part) { throw new Error(`Tag format tidak diisi: ${part.value}`); } });
  document.render(tags);
  const label = (values.reference || employee.name).replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 65);
  return {
    fileName: `Draf-${kind}-${label}${isAttendanceCase ? `-${record.id.slice(0, 8)}` : ""}.docx`,
    bytes: document.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }),
  };
}
