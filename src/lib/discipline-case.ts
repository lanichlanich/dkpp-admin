import { z } from "zod";

export const DISCIPLINE_MENU = "penjatuhan-hukdis";
export const disciplineLevels = ["Ringan", "Sedang", "Berat"] as const;
export const disciplineSanctions = [
  { id: "lisan", level: "Ringan", label: "Teguran lisan" },
  { id: "tertulis", level: "Ringan", label: "Teguran tertulis" },
  { id: "tidak-puas", level: "Ringan", label: "Pernyataan tidak puas secara tertulis" },
  { id: "tukin-6", level: "Sedang", label: "Pemotongan tunjangan kinerja 25% selama 6 bulan (Pasal 8 ayat 3)" },
  { id: "tukin-9", level: "Sedang", label: "Pemotongan tunjangan kinerja 25% selama 9 bulan (Pasal 8 ayat 3)" },
  { id: "tukin-12", level: "Sedang", label: "Pemotongan tunjangan kinerja 25% selama 12 bulan (Pasal 8 ayat 3)" },
  { id: "tunda-kgb", level: "Sedang", label: "Penundaan kenaikan gaji berkala selama 1 tahun (Pasal 42)" },
  { id: "tunda-kp", level: "Sedang", label: "Penundaan kenaikan pangkat selama 1 tahun (Pasal 42)" },
  { id: "turun-pangkat", level: "Sedang", label: "Penurunan pangkat setingkat lebih rendah selama 1 tahun (Pasal 42)" },
  { id: "turun-jabatan", level: "Berat", label: "Penurunan jabatan setingkat lebih rendah selama 12 bulan" },
  { id: "bebas-jabatan", level: "Berat", label: "Pembebasan dari jabatan menjadi pelaksana selama 12 bulan" },
  { id: "pemberhentian", level: "Berat", label: "Pemberhentian dengan hormat tidak atas permintaan sendiri sebagai PNS" },
] as const;

export const disciplineDocuments = [
  { id: "panggilan-1", label: "Surat Panggilan I" },
  { id: "panggilan-2", label: "Surat Panggilan II" },
  { id: "tim", label: "Pembentukan Tim Pemeriksa" },
  { id: "bap", label: "Berita Acara Pemeriksaan" },
  { id: "laporan", label: "Laporan Hasil Pemeriksaan" },
  { id: "lisan", label: "Keputusan Teguran Lisan" },
  { id: "tertulis", label: "Keputusan Teguran Tertulis" },
  { id: "tidak-puas", label: "Keputusan Pernyataan Tidak Puas secara Tertulis" },
  { id: "penerimaan", label: "Surat Panggilan Menerima Keputusan" },
] as const;
export type DisciplineDocument = (typeof disciplineDocuments)[number]["id"];

const line = (max = 180) => z.string().trim().max(max).refine(value => !/[\x00-\x1f\x7f]/.test(value), "Isian harus satu baris.");
const note = (max = 1500) => z.string().trim().max(max).refine(value => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value), "Karakter tidak valid.");
const date = z.union([z.literal(""), z.iso.date().refine(value => value >= "1900-01-01" && value <= "2199-12-31")]);
const person = z.object({ name: line(), nip: z.string().regex(/^(?:[0-9]{18})?$/), rank: line(), position: line(220) });
const appointment = z.object({ date, time: z.string().regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d)?$/), place: line() });
const call = appointment.extend({ number: line(), letterDate: date, attendance: z.enum(["", "hadir", "tidak-hadir"]) });

export const disciplineCaseSchema = z.object({
  reference: line(80).refine(Boolean, "Nomor register wajib diisi."),
  employeeNip: z.string().regex(/^[0-9]{18}$/, "Pilih PNS yang diperiksa."),
  allegation: note(800).refine(Boolean, "Uraian dugaan wajib diisi."),
  provision: line(250),
  incidentDate: date,
  incidentPlace: line(),
  level: z.enum(["", ...disciplineLevels]),
  examiner: person,
  authority: person,
  firstCall: call,
  secondCall: call,
  team: z.object({ number: line(), date, issuer: person, oversight: person, hr: person, other: person }),
  review: z.object({
    date, signature: z.enum(["", "ditandatangani", "menolak", "dua-kali-tidak-hadir"]),
    outcome: z.enum(["", "terbukti", "tidak-terbukti"]),
    place: line(), questions: note(2400), findings: note(), evidence: note(),
    reportDate: date, recipient: line(220), recipientPlace: line(),
    aggravating: note(500), mitigating: note(500), impact: note(500), recommendation: line(250),
  }),
  decision: z.object({
    number: line(), date, place: line(), sanction: line(40), consideration: note(800), extraBasis: line(250), issued: z.boolean(),
    delivery: appointment.extend({ letterDate: date, recipientPlace: line() }),
    sent: date, received: date, effective: date, appeal: z.enum(["", "tidak-diajukan", "keberatan", "banding", "diputus"]),
    appealDate: date, appealResult: note(800),
  }),
}).superRefine((data, ctx) => {
  const error = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const { firstCall, secondCall, review, decision, team } = data;
  for (const [key, call] of [["firstCall", firstCall], ["secondCall", secondCall]] as const) {
    if (call.date && call.letterDate && call.date < call.letterDate) error([key, "date"], "Jadwal pemeriksaan mendahului tanggal surat panggilan.");
    if (call.attendance && !call.date) error([key, "attendance"], "Catat tanggal jadwal sebelum mencatat kehadiran.");
  }
  if ((secondCall.letterDate || secondCall.attendance) && firstCall.attendance !== "tidak-hadir")
    error(["secondCall", "letterDate"], "Panggilan II dicatat setelah ketidakhadiran pada Panggilan I.");
  if (secondCall.letterDate && firstCall.date && secondCall.letterDate < firstCall.date)
    error(["secondCall", "letterDate"], "Tanggal Panggilan II mendahului jadwal Panggilan I.");
  if (review.signature === "dua-kali-tidak-hadir" &&
      (firstCall.attendance !== "tidak-hadir" || secondCall.attendance !== "tidak-hadir" || !review.evidence))
    error(["review", "evidence"], "Catat dua ketidakhadiran dan bukti yang dipakai sebelum memilih jalur tanpa pemeriksaan.");
  if (["ditandatangani", "menolak"].includes(review.signature) && (!review.date || !review.questions))
    error(["review", "questions"], "Catat tanggal dan tanya jawab pemeriksaan pada berita acara.");
  if (review.reportDate && review.date && review.reportDate < review.date)
    error(["review", "reportDate"], "Tanggal laporan mendahului tanggal pemeriksaan.");
  if (team.date && review.date && team.date > review.date)
    error(["team", "date"], "Pembentukan tim tidak boleh dicatat setelah pemeriksaan oleh tim.");
  const delivery = decision.delivery;
  if (delivery.date && (delivery.date < delivery.letterDate || (decision.date && delivery.date < decision.date)))
    error(["decision", "delivery", "date"], "Jadwal menerima keputusan mendahului surat panggilan atau penetapan.");
  const sanction = disciplineSanctions.find(item => item.id === decision.sanction);
  if (decision.sanction && (!sanction || (data.level && data.level !== sanction.level)))
    error(["decision", "sanction"], "Pilih jenis hukuman yang sesuai dengan tingkatnya.");
  if (decision.issued) {
    if (!decision.number || !decision.date || !decision.place || !sanction || !data.level || !data.authority.name || !data.authority.position || !data.provision)
      error(["decision", "issued"], "Lengkapi nomor, tanggal, tingkat, jenis hukuman, pasal, dan pejabat berwenang sebelum mencatat penetapan.");
    if (!review.signature || review.outcome !== "terbukti" || !review.findings)
      error(["decision", "issued"], "Catat hasil terbukti, uraian pelanggaran, dan dasar pemeriksaan atau bukti terlebih dahulu.");
    if (data.level === "Berat" && (!team.number || !team.date || !team.issuer.name || !data.examiner.name || !team.oversight.name || !team.hr.name))
      error(["team", "number"], "Perkara hukuman berat memerlukan tim pemeriksa yang tercatat.");
    if (decision.date && review.date && decision.date < review.date)
      error(["decision", "date"], "Tanggal keputusan mendahului pemeriksaan.");
    if (review.signature === "dua-kali-tidak-hadir" && decision.date < secondCall.date)
      error(["decision", "date"], "Tanggal keputusan mendahului jadwal Panggilan II.");
  }
  if ((decision.sent || decision.received || decision.effective || decision.appeal) && !decision.issued)
    error(["decision", "issued"], "Catat penetapan sebelum penyampaian, penerimaan, atau upaya administratif.");
  if ((decision.sent && decision.sent < decision.date) || (decision.received && decision.received < (decision.sent || decision.date)))
    error(["decision", "received"], "Periksa urutan tanggal keputusan, penyampaian, dan penerimaan.");
  if (decision.effective && (!decision.received || decision.effective < decision.received))
    error(["decision", "effective"], "Tanggal berlaku harus berdasarkan penerimaan keputusan atau hasil upaya administratif.");
  if (decision.appealDate && (!decision.received || decision.appealDate < decision.received))
    error(["decision", "appealDate"], "Tanggal pengajuan upaya administratif harus setelah keputusan diterima.");
  if (["keberatan", "banding"].includes(decision.appeal) && (!decision.appealDate || decision.effective))
    error(["decision", "appeal"], "Catat tanggal pengajuan dan kosongkan tanggal berlaku sampai upaya administratif diputus.");
  if (decision.appeal === "diputus" && (!decision.appealDate || !decision.appealResult))
    error(["decision", "appealResult"], "Catat tanggal pengajuan dan hasil upaya administratif.");
});

export type DisciplineCaseInput = z.infer<typeof disciplineCaseSchema>;
export type DisciplinePerson = z.infer<typeof person>;
export type DisciplineEmployee = DisciplinePerson & { unit: string };
export type DisciplineCase = { id: string; employee: DisciplineEmployee; values: DisciplineCaseInput; version: number };

const emptyPerson: DisciplinePerson = { name: "", nip: "", rank: "", position: "" };
const emptyAppointment = { date: "", time: "", place: "" };
const emptyCall = { ...emptyAppointment, number: "", letterDate: "", attendance: "" } as const;
export const emptyDisciplineCase: DisciplineCaseInput = {
  reference: "", employeeNip: "", allegation: "", provision: "", incidentDate: "", incidentPlace: "", level: "",
  examiner: emptyPerson, authority: emptyPerson, firstCall: emptyCall, secondCall: emptyCall,
  team: { number: "", date: "", issuer: emptyPerson, oversight: emptyPerson, hr: emptyPerson, other: emptyPerson },
  review: { date: "", signature: "", outcome: "", place: "", questions: "", findings: "", evidence: "", reportDate: "",
    recipient: "", recipientPlace: "", aggravating: "", mitigating: "", impact: "", recommendation: "" },
  decision: { number: "", date: "", place: "", sanction: "", consideration: "", extraBasis: "", issued: false,
    delivery: { ...emptyAppointment, letterDate: "", recipientPlace: "" }, sent: "", received: "", effective: "", appeal: "", appealDate: "", appealResult: "" },
};

export function disciplineCaseStatus({ firstCall, review, decision }: DisciplineCaseInput) {
  if (["keberatan", "banding"].includes(decision.appeal)) return "Upaya administratif";
  if (decision.effective) return "Tanggal berlaku tercatat";
  if (decision.received) return "Keputusan diterima";
  if (decision.issued) return "Keputusan ditetapkan";
  if (review.outcome === "tidak-terbukti") return "Tidak terbukti";
  if (review.signature) return "Hasil pemeriksaan tercatat";
  return firstCall.letterDate ? "Pemanggilan" : "Draf perkara";
}
