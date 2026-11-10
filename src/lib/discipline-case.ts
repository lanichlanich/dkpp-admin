import { z } from "zod";

export const DISCIPLINE_MENU = "penjatuhan-hukdis";
export const disciplineLevels = ["Ringan", "Sedang", "Berat"] as const;
type AbsenceRule = {
  level: (typeof disciplineLevels)[number];
  provision: string;
};

const absenceRules: (AbsenceRule & { max: number })[] = [
  { max: 3, level: "Ringan", provision: "Pasal 9 ayat (2) huruf b angka 1" },
  { max: 6, level: "Ringan", provision: "Pasal 9 ayat (2) huruf b angka 2" },
  { max: 10, level: "Ringan", provision: "Pasal 9 ayat (2) huruf b angka 3" },
  { max: 13, level: "Sedang", provision: "Pasal 10 ayat (2) huruf f angka 1" },
  { max: 16, level: "Sedang", provision: "Pasal 10 ayat (2) huruf f angka 2" },
  { max: 20, level: "Sedang", provision: "Pasal 10 ayat (2) huruf f angka 3" },
  { max: 24, level: "Berat", provision: "Pasal 11 ayat (2) huruf d angka 1" },
  { max: 27, level: "Berat", provision: "Pasal 11 ayat (2) huruf d angka 2" },
  { max: 366, level: "Berat", provision: "Pasal 11 ayat (2) huruf d angka 3" },
];
const consecutiveRule: AbsenceRule = {
  level: "Berat", provision: "Pasal 11 ayat (2) huruf d angka 4",
};

const absenceDaysSchema = z.number().int().min(1).max(366, "Jumlah hari dalam satu tahun paling banyak 366.");
export function classifyDisciplineAbsence(days: number | undefined, consecutive: boolean | undefined) {
  if (days === undefined || !absenceDaysSchema.safeParse(days).success || (consecutive && days < 10)) return;

  const rule = consecutive ? consecutiveRule : days >= 3 ? absenceRules.find(item => days <= item.max) : undefined;
  const obligation = "Pasal 4 huruf f";
  const pattern = consecutive
    ? (days === 10 ? " berturut-turut" : ", termasuk sedikitnya 10 hari kerja berturut-turut")
    : " secara kumulatif dalam satu tahun berjalan";
  return {
    allegation: `tidak masuk kerja tanpa alasan yang sah selama ${days} hari kerja${pattern}`,
    level: rule?.level ?? "" as const,
    provision: rule ? `${obligation} juncto ${rule.provision}` : obligation,
  };
}

export const disciplineDocuments = [
  { id: "panggilan-1", label: "Surat Panggilan I" },
  { id: "panggilan-2", label: "Surat Panggilan II" },
  { id: "tim", label: "Pembentukan Tim Pemeriksa" },
  { id: "bap-1", label: "BAP Panggilan I" },
  { id: "bap-2", label: "BAP Panggilan II" },
  { id: "laporan", label: "Laporan Hasil Pemeriksaan" },
] as const;
export type DisciplineDocument = (typeof disciplineDocuments)[number]["id"] | "bap";
export const disciplineCalls = ["firstCall", "secondCall"] as const;

const line = (max = 180) => z.string().trim().max(max).refine(value => !/[\x00-\x1f\x7f]/.test(value), "Isian harus satu baris.");
const note = (max = 1500) => z.string().trim().max(max).refine(value => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value), "Karakter tidak valid.");
const date = z.union([z.literal(""), z.iso.date().refine(value => value >= "1900-01-01" && value <= "2199-12-31")]);
const person = z.object({ name: line(), nip: z.string().regex(/^(?:[0-9]{18})?$/), rank: line(), position: line(220) });
const appointment = z.object({ date, time: z.string().regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d)?$/), place: line() });
const call = appointment.extend({ number: line(), letterDate: date, attendance: z.enum(["", "hadir", "tidak-hadir"]) });
const examination = z.object({ date, place: line(), questions: note(2400), signature: z.enum(["", "ditandatangani", "menolak"]) });
export type DisciplineExamination = z.infer<typeof examination>;
const emptyPerson = { name: "", nip: "", rank: "", position: "" };
const emptyAppointment = { date: "", time: "", place: "" };
const emptyDecision = { number: "", date: "", place: "", sanction: "", consideration: "", extraBasis: "", issued: false,
  delivery: { ...emptyAppointment, letterDate: "", recipientPlace: "" }, sent: "", received: "", effective: "", appeal: "", appealDate: "", appealResult: "" } as const;

export const disciplineCaseSchema = z.object({
  reference: line(80).default(""),
  employeeNip: z.string().regex(/^[0-9]{18}$/, "Pilih PNS yang diperiksa."),
  absenceDays: absenceDaysSchema.optional(),
  consecutiveAbsence: z.boolean().optional(),
  allegation: note(800).default(""),
  provision: line(250).default(""),
  incidentDate: date.default(""),
  incidentPlace: line().default(""),
  level: z.enum(["", ...disciplineLevels]).default(""),
  examiner: person,
  authority: person.default(emptyPerson),
  firstCall: call,
  secondCall: call,
  team: z.object({ number: line(), date, issuer: person, oversight: person, hr: person, other: person }),
  review: z.object({
    date, signature: z.enum(["", "ditandatangani", "menolak", "dua-kali-tidak-hadir"]),
    outcome: z.enum(["", "terbukti", "tidak-terbukti"]),
    place: line(), questions: note(2400), findings: note(), evidence: note(),
    reportDate: date, recipient: line(220), recipientPlace: line(),
    aggravating: note(500), mitigating: note(500), impact: note(500), recommendation: line(250),
    sessions: z.object({ firstCall: examination.optional(), secondCall: examination.optional() }).optional(),
  }),
  decision: z.object({
    number: line(), date, place: line(), sanction: line(40), consideration: note(800), extraBasis: line(250), issued: z.boolean(),
    delivery: appointment.extend({ letterDate: date, recipientPlace: line() }),
    sent: date, received: date, effective: date, appeal: z.enum(["", "tidak-diajukan", "keberatan", "banding", "diputus"]),
    appealDate: date, appealResult: note(800),
  }).default(emptyDecision),
}).transform(data => {
  const absence = classifyDisciplineAbsence(data.absenceDays, data.consecutiveAbsence);
  if (!absence) return data;
  const { allegation, level, provision } = absence;
  return { ...data, allegation, level, provision, reference: "", incidentDate: "", incidentPlace: "" };
}).superRefine((data, ctx) => {
  const error = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const { firstCall, secondCall, review, team } = data;
  const absence = classifyDisciplineAbsence(data.absenceDays, data.consecutiveAbsence);
  if (data.consecutiveAbsence && !absence) error(["consecutiveAbsence"], "Tandai berturut-turut jika ada sedikitnya 10 hari kerja tanpa putus.");
  for (const key of disciplineCalls) {
    const call = data[key];
    if (call.date && call.letterDate && call.date < call.letterDate) error([key, "date"], "Jadwal pemeriksaan mendahului tanggal surat panggilan.");
    if (call.attendance && !call.date) error([key, "attendance"], "Catat tanggal jadwal sebelum mencatat kehadiran.");
  }
  if ((secondCall.letterDate || secondCall.attendance) && !firstCall.date)
    error(["firstCall", "date"], "Catat jadwal Panggilan I sebelum mencatat Panggilan II.");
  if (secondCall.letterDate && secondCall.letterDate < firstCall.date)
    error(["secondCall", "letterDate"], "Tanggal Panggilan II mendahului jadwal Panggilan I.");
  if (secondCall.date && secondCall.date < firstCall.date)
    error(["secondCall", "date"], "Jadwal Panggilan II mendahului jadwal Panggilan I.");
  if (review.signature === "dua-kali-tidak-hadir" &&
      (firstCall.attendance !== "tidak-hadir" || secondCall.attendance !== "tidak-hadir" || !review.evidence))
    error(["review", "evidence"], "Catat dua ketidakhadiran dan bukti yang dipakai sebelum memilih jalur tanpa pemeriksaan.");
  const sessions = getDisciplineExaminations(data);
  for (const key of disciplineCalls) {
    const session = sessions[key];
    if (!session) continue;
    const title = key === "firstCall" ? "Panggilan I" : "Panggilan II";
    if (review.sessions && (!data[key].date || data[key].attendance === "tidak-hadir"))
      error(["review", "sessions", key], `Catatan pemeriksaan ${title} memerlukan jadwal dan kehadiran PNS.`);
    if (review.sessions && session.date && session.date < data[key].letterDate)
      error(["review", "sessions", key, "date"], `Tanggal pemeriksaan ${title} mendahului surat panggilannya.`);
    if (session.signature && (!session.date || !session.questions))
      error(["review", "sessions", key], `Catat tanggal dan tanya jawab sebelum mencatat penandatanganan BAP ${title}.`);
    if (session.date && review.reportDate && review.reportDate < session.date)
      error(["review", "reportDate"], `Tanggal laporan mendahului pemeriksaan ${title}.`);
    if (session.date && team.date > session.date)
      error(["team", "date"], `Tanggal pembentukan tim tidak boleh sesudah pemeriksaan ${title}.`);
  }
  if (sessions.firstCall?.date && sessions.secondCall?.date && sessions.secondCall.date < sessions.firstCall.date)
    error(["review", "sessions", "secondCall", "date"], "Tanggal pemeriksaan Panggilan II mendahului pemeriksaan Panggilan I.");
  if (review.signature === "dua-kali-tidak-hadir" && review.reportDate && review.reportDate < secondCall.date)
    error(["review", "reportDate"], "Tanggal laporan mendahului jadwal Panggilan II.");
});

export type DisciplineCaseInput = z.infer<typeof disciplineCaseSchema>;
export type DisciplinePerson = z.infer<typeof person>;
export type DisciplineEmployee = DisciplinePerson & { unit: string };
export type DisciplineCase = { id: string; employee: DisciplineEmployee; values: DisciplineCaseInput; version: number };

const emptyCall = { ...emptyAppointment, number: "", letterDate: "", attendance: "" } as const;
export const emptyDisciplineCase: DisciplineCaseInput = {
  reference: "", employeeNip: "", allegation: "", provision: "", incidentDate: "", incidentPlace: "", level: "",
  examiner: emptyPerson, authority: emptyPerson, firstCall: emptyCall, secondCall: emptyCall,
  team: { number: "", date: "", issuer: emptyPerson, oversight: emptyPerson, hr: emptyPerson, other: emptyPerson },
  review: { date: "", signature: "", outcome: "", place: "", questions: "", findings: "", evidence: "", reportDate: "",
    recipient: "", recipientPlace: "", aggravating: "", mitigating: "", impact: "", recommendation: "" },
  decision: emptyDecision,
};

export function getDisciplineExaminations({ firstCall, secondCall, review }: Pick<DisciplineCaseInput, "firstCall" | "secondCall" | "review">): NonNullable<DisciplineCaseInput["review"]["sessions"]> {
  if (review.sessions) return review.sessions;
  const { date, place, questions, signature } = review;
  if (signature === "dua-kali-tidak-hadir" || (!date && !place && !questions && !signature)) return {};
  const key = secondCall.date && secondCall.attendance !== "tidak-hadir"
    && ((date === secondCall.date && date !== firstCall.date) || firstCall.attendance === "tidak-hadir")
    ? "secondCall" : "firstCall";
  return { [key]: { date, place, questions, signature } };
}

export function disciplineCaseStatus(values: DisciplineCaseInput) {
  const { firstCall, review } = values;
  if (review.outcome === "tidak-terbukti") return "Tidak terbukti";
  if (review.signature === "dua-kali-tidak-hadir" || Object.values(getDisciplineExaminations(values)).some(item => item?.signature))
    return "Hasil pemeriksaan tercatat";
  return firstCall.letterDate ? "Pemanggilan" : "Draf perkara";
}
