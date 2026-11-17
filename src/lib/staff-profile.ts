import source from "@/data/retirement-position-map-2026.json";
import { buildRetirementProjection, type ProjectionEmployee } from "@/lib/retirement-projection";
import { buildProjectionHierarchy, sortProjectionEmployees } from "@/lib/retirement-projection-hierarchy";
import { normalizeProjectionUnit } from "@/lib/retirement-projection";
import { EMPLOYEE_DOCUMENT_TYPE_LABELS, type EmployeeDocumentType } from "@/lib/employee-document-types";

export const PROFILE_ORGANIZATION = "Dinas Ketahanan Pangan dan Pertanian Kabupaten Indramayu";
export const PROFILE_CHAPTERS = [
  "Pendahuluan", "Struktur Organisasi dan Penempatan", "Komposisi dan Karakteristik Pegawai",
  "Kebutuhan dan Keterisian Jabatan", "Proyeksi Pensiun Lima Tahun",
  "Administrasi Kepegawaian dan Kelengkapan Data", "Penutup dan Tindak Lanjut",
];
export type StaffProfileInput = {
  employees: (ProjectionEmployee & { gender: string; organizationUnitId: string | null })[];
  units: { id: string; name: string; parentId: string | null }[];
  documents: { nip: string; type: string; count: number }[];
  kgb: { nip: string; tmt: string | null; count: number }[];
  acting: { startDate: string; endDate: string; closedAt: string | null; nextStartDate: string | null }[];
};
export type ReportColumn = { title: string; weight: number; align?: "left" | "center" };
export type ReportBlock = { type: "paragraph" | "heading"; text: string } | {
  type: "table"; columns: ReportColumn[]; rows: string[][]; indents?: number[];
};
export type ReportSection = { title: string; subtitle: string; landscape?: boolean; blocks: ReportBlock[] };
export type StaffProfileReport = {
  today: string; dateLabel: string; startYear: number; endYear: number;
  summary: { active: number; required: number; mapped: number; unmatched: number; retirees: number; documented: number };
  sections: ReportSection[];
};
const roman = ["I", "II", "III", "IV", "V", "VI", "VII"];
const text = (value: unknown) => String(value ?? "").trim() || "Belum tercatat";
const displayRank = (value: string) => /^(?:null|undefined|[\s/–-])+$/i.test(value) ? "Belum tercatat" : text(value);
const count = (items: string[]) => [...items.reduce((map, key) => map.set(key, (map.get(key) ?? 0) + 1), new Map<string, number>())]
  .sort((a, b) => a[0].localeCompare(b[0], "id"));
const paragraph = (value: string): ReportBlock => ({ type: "paragraph", text: value });
const heading = (value: string): ReportBlock => ({ type: "heading", text: value });
const col = (title: string, weight: number, center = false): ReportColumn => ({ title, weight, align: center ? "center" : "left" });
const table = (columns: ReportColumn[], rows: (string | number)[][], indents?: number[]): ReportBlock => ({
  type: "table", columns, rows: rows.map(row => row.map(value => String(value))), indents,
});
const addYears = (iso: string, years: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const day = Math.min(d, new Date(Date.UTC(y + years, m, 0)).getUTCDate());
  return `${y + years}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};
const isoDate = (value: string | null) => value ? value.slice(0, 10) : null;
const ageAt = (birth: string | null, today: string) => {
  if (!birth || birth > today) return null;
  return Number(today.slice(0, 4)) - Number(birth.slice(0, 4)) - (today.slice(5) < birth.slice(5) ? 1 : 0);
};
function genderLabel(value: string, nip: string) {
  const gender = value?.trim().toLowerCase();
  if (["l", "laki-laki", "laki laki", "pria", "male"].includes(gender)) return "Laki-laki";
  if (["p", "perempuan", "wanita", "female"].includes(gender)) return "Perempuan";
  return /^\d{18}$/.test(nip) && nip[14] === "1" ? "Laki-laki" : /^\d{18}$/.test(nip) && nip[14] === "2" ? "Perempuan" : "Belum diketahui";
}

export function buildStaffProfile(input: StaffProfileInput, today: string, startYear: number): StaffProfileReport {
  const projection = buildRetirementProjection(source.positions, input.employees,
    { startYear, kind: "all", unit: "", asn: "all", search: "" }, today);
  const active = input.employees.filter(e => e.status === "Aktif"), n = active.length;
  const byNip = new Map(active.map(e => [e.nip, e]));
  const years = projection.years, endYear = years[4];
  const dateLabel = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${today}T00:00:00Z`));
  const percent = (value: number) => `${(n ? value / n * 100 : 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
  const distribution = (title: string, items: string[], total = n) => {
    const rows: (string | number)[][] = count(items).map(([key, value]) => [key, value,
      `${(total ? value / total * 100 : 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`]);
    rows.push(["Jumlah", items.length, items.length ? "100%" : "0%"]);
    return table([col(title, 6), col("Jumlah", 1, true), col("Persentase", 1.5, true)], rows);
  };
  const section = (i: number, blocks: ReportBlock[]): ReportSection => ({ title: `BAB ${roman[i]}`, subtitle: PROFILE_CHAPTERS[i], blocks });

  // Each employee contributes once to direct placement, then once to each ancestor.
  // Names provide a fallback only when they resolve to exactly one master unit.
  const unitIndex = new Map(input.units.map(u => [u.id, u]));
  const names = new Map<string, string[]>();
  for (const unit of input.units) {
    const key = normalizeProjectionUnit(unit.name); names.set(key, [...(names.get(key) ?? []), unit.id]);
  }
  const direct = new Map<string, number>(), rolled = new Map<string, number>();
  let unknownUnit = 0;
  for (const employee of active) {
    const candidates = names.get(normalizeProjectionUnit(employee.unit)) ?? [];
    let id = employee.organizationUnitId && unitIndex.has(employee.organizationUnitId) ? employee.organizationUnitId
      : candidates.length === 1 ? candidates[0] : null;
    if (!id) { unknownUnit++; continue; }
    direct.set(id, (direct.get(id) ?? 0) + 1);
    const visited = new Set<string>();
    while (id && unitIndex.has(id) && !visited.has(id)) {
      visited.add(id); rolled.set(id, (rolled.get(id) ?? 0) + 1);
      id = unitIndex.get(id)?.parentId ?? null;
    }
  }
  const unitRows: (string | number)[][] = [], unitIndents: number[] = [], visitedUnits = new Set<string>();
  const appendUnit = (id: string, depth: number) => {
    if (visitedUnits.has(id)) return;
    visitedUnits.add(id); const unit = unitIndex.get(id)!;
    unitRows.push([unit.name, direct.get(id) ?? 0, rolled.get(id) ?? 0]); unitIndents.push(depth);
    input.units.filter(u => u.parentId === id).forEach(u => appendUnit(u.id, depth + 1));
  };
  input.units.filter(u => !u.parentId || !unitIndex.has(u.parentId)).forEach(u => appendUnit(u.id, 0));
  input.units.forEach(u => appendUnit(u.id, 0)); // Retain malformed/cyclic master records without looping.
  if (unknownUnit) { unitRows.push(["Belum terhubung dengan master unit", unknownUnit, unknownUnit]); unitIndents.push(0); }

  const signedKgb = input.kgb.filter(k => byNip.has(k.nip));
  const archives = [...input.documents, ...signedKgb.map(k => ({ nip: k.nip, type: "sk_kgb", count: k.count }))];
  const documented = new Set(archives.filter(d => byNip.has(d.nip) && Number(d.count) > 0).map(d => d.nip));
  const docTotals = new Map<string, number>(), docPeople = new Map<string, Set<string>>();
  for (const doc of archives.filter(d => byNip.has(d.nip))) {
    const type = EMPLOYEE_DOCUMENT_TYPE_LABELS[doc.type as EmployeeDocumentType] ?? text(doc.type).replaceAll("_", " ");
    docTotals.set(type, (docTotals.get(type) ?? 0) + Number(doc.count));
    if (!docPeople.has(type)) docPeople.set(type, new Set()); docPeople.get(type)!.add(doc.nip);
  }
  const dueKgb = signedKgb.map(k => isoDate(k.tmt)).filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)).map(d => addYears(d, 2));
  const next90 = new Date(Date.parse(`${today}T00:00:00Z`) + 90 * 86_400_000).toISOString().slice(0, 10);
  const pltCounts = { aktif: 0, segera: 0, habis: 0, mendatang: 0, selesai: 0 };
  for (const acting of input.acting) {
    if (acting.closedAt || (acting.nextStartDate && acting.nextStartDate <= today)) { pltCounts.selesai++; continue; }
    if (acting.startDate > today) { pltCounts.mendatang++; continue; }
    if (acting.endDate < today) { pltCounts.habis++; continue; }
    pltCounts.aktif++;
    if (Date.parse(`${acting.endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`) <= 14 * 86_400_000) pltCounts.segera++;
  }
  const ageBuckets = ["Di bawah 30 tahun", "30–39 tahun", "40–49 tahun", "50–57 tahun", "58 tahun ke atas", "Belum diketahui"];
  const ages = projection.employees.map(e => ageAt(e.birthDate, today));
  const ageCounts = ageBuckets.map((label, i) => [label, ages.filter(a => i === 5 ? a === null : a !== null &&
    (i === 0 ? a < 30 : i === 1 ? a >= 30 && a < 40 : i === 2 ? a >= 40 && a < 50 : i === 3 ? a >= 50 && a < 58 : a >= 58)).length] as [string, number]);
  const pns = active.filter(e => e.asnType === "PNS");
  const rankLabels = pns.map(e => e.rank.match(/\b(IV|III|II|I)\s*\/\s*([a-e])\b/i)?.slice(1).join("/").replace(/\/([A-E])/g, (_, letter: string) => `/${letter.toLowerCase()}`) || "Belum tercatat / belum dikenali");
  const functional = projection.employees.filter(e => e.kind === "Fungsional");
  const levels = functional.map(e => e.position.match(/ahli\s+(utama|madya|muda|pertama)|penyelia|mahir|terampil|pemula/i)?.[0].replace(/\b\w/g, c => c.toUpperCase()) || "Jenjang belum tercatat");
  const gapRows: (string | number)[][] = projection.summaries.map(s => {
    const rows = projection.rows.filter(r => r.kind === s.kind);
    return [s.kind, s.required, s.mappedActive, s.mappedActive - s.required,
      -rows.reduce((v, r) => v + Math.max(0, r.required - r.active), 0), rows.reduce((v, r) => v + Math.max(0, r.active - r.required), 0)];
  });
  const shortage = -projection.rows.reduce((v, r) => v + Math.max(0, r.required - r.active), 0);
  const surplus = projection.rows.reduce((v, r) => v + Math.max(0, r.active - r.required), 0);
  gapRows.push(["Jumlah", projection.required, projection.mappedActive, projection.mappedActive - projection.required, shortage, surplus]);
  const hierarchy = buildProjectionHierarchy(source.positions);
  const employees = sortProjectionEmployees(hierarchy, projection.employees);
  const retirementRows = years.map((year, i) => [year,
    ...["Fungsional", "Pelaksana", "Struktural"].map(kind => projection.retirees.filter(e => e.kind === kind && e.retirementTmt?.startsWith(`${year}-`)).length),
    projection.retirees.filter(e => e.retirementTmt?.startsWith(`${year}-`)).length,
    projection.rows.reduce((sum, r) => sum + r.remaining[i], 0),
    projection.rows.reduce((sum, r) => sum + r.balance[i], 0)]);
  const missing = [
    ["NIP atau tanggal lahir belum valid", projection.employees.filter(e => !e.birthDate).length],
    ["Jenis kelamin belum diketahui", active.filter(e => genderLabel(e.gender, e.nip) === "Belum diketahui").length],
    ["Unit belum terhubung dengan master organisasi", unknownUnit],
    ["Penempatan belum cocok dengan peta jabatan", projection.unmapped],
    ["PNS dengan golongan belum tercatat atau belum dikenali", rankLabels.filter(r => r.startsWith("Belum")).length],
    ["TMT pensiun belum dapat dihitung", projection.unknownDates],
    ["TMT pensiun sudah lewat tetapi status masih aktif", projection.employees.filter(e => e.retirementTmt && e.retirementTmt < today).length],
    ["Pegawai tanpa arsip pada Dokumen Pegawai", n - documented.size],
  ];

  const sections: ReportSection[] = [
    section(0, [heading("A Umum"),
      paragraph(`Profil kepegawaian ${PROFILE_ORGANIZATION} menyajikan keadaan pegawai per ${dateLabel}. Terdapat ${n} pegawai aktif, dengan ${projection.mappedActive} pegawai terpetakan pada kebutuhan jabatan dan ${projection.unmapped} pegawai yang penempatannya masih perlu dicocokkan. Dokumen ini menjadi bahan pemutakhiran data, penataan pegawai, dan persiapan penggantian pegawai yang mencapai batas usia pensiun.`),
      heading("B Maksud dan Ruang Lingkup"),
      paragraph(`Profil ini meliputi struktur organisasi, komposisi ASN, karakteristik pegawai, kebutuhan dan keterisian jabatan, proyeksi pensiun tahun ${startYear} sampai dengan ${endYear}, serta administrasi dokumen. Lampiran memuat seluruh pegawai aktif, seluruh penempatan pada peta jabatan, dan pegawai dalam periode proyeksi pensiun.`),
      heading("C Sumber dan Metode"),
      paragraph(`Data berasal dari basis data pegawai dan master organisasi aplikasi, arsip Dokumen Pegawai, SK KGB yang telah ditandatangani, serta Daftar Plt. Kebutuhan jabatan mengacu pada Peta Jabatan DKPP 2026, Keputusan Bupati Nomor ${source.decree} tanggal ${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${source.decreeDate}T00:00:00Z`))}. Peta tersebut memuat ${source.positions.length} penempatan dengan kebutuhan ${projection.required} pegawai.`),
      paragraph("Statistik utama hanya menghitung pegawai berstatus Aktif. Tanggal lahir dihitung dari delapan digit awal NIP yang valid; jenis kelamin memakai data pegawai dan digit NIP sebagai cadangan. Setiap pegawai dihitung satu kali dalam komposisi. Dokumen ini merupakan profil administratif berdasarkan data aplikasi dan memerlukan pemutakhiran apabila terjadi perubahan pegawai atau organisasi."),
      distribution("Status pada basis data", input.employees.map(e => text(e.status)), input.employees.length),
    ]),
    section(1, [heading("A Susunan Organisasi"),
      paragraph(`Master organisasi memuat ${input.units.length} unit. Tabel berikut mengikuti hubungan induk dan turunan pada master tersebut. Kolom langsung menghitung pegawai yang ditempatkan pada unit yang bersangkutan; kolom termasuk turunan menjumlahkan pegawai unit tersebut dan seluruh unit di bawahnya. Jumlah antarbaris kolom termasuk turunan tidak dijumlahkan lagi karena mencakup pegawai yang sama.`),
      table([col("Unit organisasi", 6), col("Langsung", 1, true), col("Termasuk turunan", 1.6, true)], unitRows, unitIndents),
      heading("B Penempatan Pegawai"),
      paragraph(`Sebanyak ${n - unknownUnit} pegawai aktif dapat dihubungkan dengan master organisasi dan ${unknownUnit} pegawai belum dapat dihubungkan secara pasti. Hubungan ditentukan dari jabatan yang terkait dengan master unit, atau kecocokan nama unit yang tunggal. Rincian jabatan dan unit setiap pegawai terdapat pada Lampiran I.`),
    ]),
    section(2, [heading("A Jenis ASN"), distribution("Jenis ASN", active.map(e => text(e.asnType))),
      paragraph("Komposisi jenis ASN membedakan PNS, PPPK, dan PPPK PW sesuai pencatatan aplikasi. Persentase dihitung terhadap seluruh pegawai aktif."),
      heading("B Jenis dan Jenjang Jabatan"), distribution("Jenis jabatan", projection.employees.map(e => e.kind)),
      paragraph("Pengelompokan jabatan mengikuti jenis pada peta jabatan apabila penempatan atau nama jabatan dapat dikenali. Jenis pada data pegawai digunakan untuk jabatan yang belum dikenali oleh peta. Pengelompokan ini digunakan secara konsisten pada kebutuhan dan proyeksi pensiun."),
      distribution("Jenjang fungsional", levels, functional.length),
      heading("C Jenis Kelamin"), distribution("Jenis kelamin", active.map(e => genderLabel(e.gender, e.nip))),
      heading("D Kelompok Usia"), table([col("Kelompok usia", 6), col("Jumlah", 1, true), col("Persentase", 1.5, true)], ageCounts.map(([label, value]) => [label, value, percent(value)])),
      paragraph(`Usia dihitung pada ${dateLabel}, dengan mengurangi satu tahun apabila ulang tahun pada tahun berjalan belum terlewati. Data yang belum dapat dihitung ditampilkan sebagai belum diketahui.`),
      heading("E Golongan Ruang PNS"), distribution("Golongan ruang", rankLabels, pns.length),
      paragraph("Tabel golongan ruang hanya mencakup PNS. Golongan PPPK tidak disetarakan dengan golongan ruang PNS. Data pendidikan, riwayat diklat, dan masa kerja tidak disimpulkan dari nama jabatan atau NIP karena belum tersedia sebagai data terstruktur dalam cakupan profil ini."),
    ]),
    section(3, [heading("A Kebutuhan dan Keterisian Saat Ini"),
      paragraph(`Kebutuhan ${projection.required} pegawai dibandingkan dengan ${projection.mappedActive} pegawai aktif yang jabatan dan unitnya cocok dengan peta. Sebanyak ${projection.unmapped} pegawai belum terpetakan tetap dicantumkan pada daftar pegawai, tetapi belum mengisi kebutuhan penempatan tertentu. Penempatan dengan kebutuhan nol tetap ditampilkan pada Lampiran II.`),
      table([col("Jenis jabatan", 2.5), col("Kebutuhan", 1.3, true), col("Terisi", 1, true), col("Selisih", 1, true), col("Kekurangan", 1.5, true), col("Kelebihan", 1.4, true)], gapRows),
      heading("B Cara Membaca Selisih"),
      paragraph(`Selisih dihitung sebagai pegawai terisi dikurangi kebutuhan. Angka negatif menunjukkan kekurangan, angka positif menunjukkan kelebihan, dan nol menunjukkan sesuai kebutuhan. Kekurangan ${shortage} dan kelebihan ${surplus} dijumlahkan terpisah pada setiap penempatan agar kelebihan di suatu jabatan tidak menutupi kekurangan pada jabatan lain.`),
      heading("C Arah Penataan"),
      paragraph("Penetapan pengisian jabatan perlu memperhatikan kesesuaian kualifikasi, kompetensi, dan ketentuan pengangkatan. Angka kebutuhan dalam profil ini merupakan pembandingan administratif terhadap peta jabatan yang menjadi sumber; perubahan kebutuhan harus mengikuti pembaruan dokumen peta jabatan yang berlaku."),
    ]),
    section(4, [heading("A Dasar Penghitungan"),
      paragraph(`Proyeksi mencakup TMT pensiun 1 Januari ${startYear} sampai dengan 31 Desember ${endYear}. Terdapat ${projection.retirees.length} pegawai dalam rentang tersebut, termasuk ${projection.retirees.filter(e => !e.requirementId).length} pegawai yang penempatannya belum terpetakan. BUP mengikuti jenis, jenjang, dan eselon jabatan pada aturan penghitungan aplikasi. TMT dihitung pada tanggal satu bulan berikutnya setelah mencapai BUP.`),
      paragraph("Proyeksi mengasumsikan belum ada penerimaan, mutasi, perubahan jabatan, atau perubahan kebijakan BUP. Untuk PPPK, tanggal yang ditampilkan merupakan proyeksi BUP jabatan dan bukan tanggal berakhirnya kontrak. Hasil perlu diverifikasi kembali sebelum digunakan untuk proses pemberhentian atau penetapan hak kepegawaian."),
      heading("B Rekap Tahunan"),
      table([col("Tahun", 1, true), col("Fungsional", 1.5, true), col("Pelaksana", 1.5, true), col("Struktural", 1.5, true), col("Total pensiun", 1.4, true), col("Sisa terpetakan", 1.7, true), col("Selisih kebutuhan", 1.7, true)], retirementRows),
      paragraph(`Kolom pensiun mencakup seluruh pegawai aktif dalam periode, sedangkan sisa dan selisih hanya menghitung pegawai terpetakan. Sebanyak ${projection.beforePeriod} pegawai terpetakan mempunyai TMT sebelum awal periode dan dikurangkan dari sisa. Sebanyak ${projection.unknownDates} pegawai belum mempunyai TMT yang dapat dihitung; pegawai tersebut tetap dihitung pada sisa sampai datanya dapat diverifikasi.`),
      heading("C Kebutuhan Penggantian"),
      paragraph(`Pada akhir ${endYear}, pegawai terpetakan diproyeksikan tersisa ${projection.rows.reduce((v, r) => v + r.remaining[4], 0)} orang. Rincian perubahan keterisian setiap penempatan disajikan pada Lampiran II dan identitas pegawai yang diproyeksikan pensiun disajikan pada Lampiran III. Persiapan penggantian perlu dilakukan dengan memperhatikan jabatan dan unit yang terdampak, bukan hanya jumlah keseluruhan.`),
    ]),
    section(5, [heading("A Arsip Dokumen Pegawai"),
      paragraph(`Sebanyak ${documented.size} dari ${n} pegawai aktif (${percent(documented.size)}) mempunyai arsip pada Dokumen Pegawai; ${n - documented.size} pegawai belum mempunyai arsip. Keberadaan arsip belum menunjukkan seluruh persyaratan administrasi telah lengkap.`),
      table([col("Jenis dokumen", 6), col("Arsip", 1, true), col("Pegawai", 1.3, true)], [...docTotals].sort((a, b) => a[0].localeCompare(b[0], "id")).map(([type, total]) => [type, total, docPeople.get(type)!.size])),
      heading("B SK KGB yang Telah Ditandatangani"),
      paragraph(`SK KGB bertanda tangan tersedia bagi ${signedKgb.length} pegawai aktif. Pengingat dihitung dua tahun setelah TMT terakhir. Dari ${dueKgb.length} TMT yang dapat dihitung, ${dueKgb.filter(d => d <= today).length} telah mencapai tanggal pengingat dan ${dueKgb.filter(d => d > today && d <= next90).length} akan mencapai tanggal tersebut dalam 90 hari. Penerbitan KGB tetap memerlukan pemeriksaan persyaratan.`),
      heading("C Penugasan Pelaksana Tugas"),
      paragraph(`Dari ${input.acting.length} periode Plt., terdapat ${pltCounts.aktif} periode aktif, termasuk ${pltCounts.segera} yang berakhir dalam 14 hari; ${pltCounts.habis} periode habis tanpa penutupan atau penggantian; ${pltCounts.mendatang} belum dimulai; dan ${pltCounts.selesai} selesai atau telah digantikan. Satu pegawai dapat mempunyai beberapa periode penugasan.`),
      heading("D Kelengkapan dan Pemutakhiran Data"), table([col("Unsur yang perlu ditindaklanjuti", 7), col("Jumlah pegawai", 1.7, true)], missing),
      paragraph("Satu pegawai dapat muncul pada beberapa unsur; jumlah antarbaris tidak dijumlahkan. Pendidikan, diklat, dan masa kerja perlu dicatat tersendiri sebelum dianalisis."),
    ]),
    section(6, [heading("A Kesimpulan"),
      paragraph(`Keadaan kepegawaian per ${dateLabel} terdiri atas ${n} pegawai aktif dengan kebutuhan peta jabatan ${projection.required} pegawai. Sebanyak ${projection.mappedActive} pegawai telah terpetakan dan ${projection.unmapped} pegawai memerlukan pencocokan penempatan. Dalam periode ${startYear} sampai dengan ${endYear}, sebanyak ${projection.retirees.length} pegawai diproyeksikan mencapai TMT pensiun menurut penghitungan aplikasi.`),
      heading("B Tindak Lanjut"),
      paragraph(`1. Melakukan pencocokan jabatan dan unit bagi ${projection.unmapped} pegawai yang belum terpetakan, serta memeriksa data pada Bab VI sebelum memperbarui perencanaan kebutuhan.`),
      paragraph(`2. Menyusun prioritas pengisian berdasarkan kekurangan pada masing-masing penempatan dan jadwal pensiun pada Lampiran II serta Lampiran III, dengan memeriksa kualifikasi dan kompetensi pegawai.`),
      paragraph(`3. Melengkapi arsip bagi ${n - documented.size} pegawai yang belum mempunyai dokumen pada modul Dokumen Pegawai; memeriksa ketepatan metadata dan keterbacaan dokumen yang telah diunggah.`),
      paragraph("4. Memeriksa pengingat KGB, penugasan Plt. yang segera berakhir, serta perubahan status pegawai secara berkala; memperbarui profil setelah perubahan data disahkan pada aplikasi."),
      heading("C Penutup"),
      paragraph("Profil ini disusun sebagai bahan kerja administrasi kepegawaian dinas. Informasi dan lampiran merupakan satu kesatuan dan digunakan sesuai kewenangan akses data kepegawaian. Pembaruan data sumber akan tercermin pada dokumen yang diunduh berikutnya."),
    ]),
    { title: "LAMPIRAN I", subtitle: "Daftar Pegawai Aktif", landscape: true, blocks: [
      paragraph(`Seluruh ${n} pegawai aktif per ${dateLabel}. Urutan mengikuti hierarki peta jabatan; pegawai yang belum terpetakan tetap disertakan. NIP disajikan sebagai teks. Usia dalam tahun dan TMT dalam format tahun-bulan-tanggal.`),
      table([col("No", .65, true), col("Nama dan NIP", 2.7), col("Jabatan", 3), col("Unit kerja", 2.8), col("Jenis ASN dan jabatan", 1.5), col("Golongan dan jenis kelamin", 1.3), col("Usia / BUP", .9, true), col("TMT pensiun", 1.4, true)],
        employees.map((e, i) => [i + 1, `${e.name}\n${e.nip}`, e.position, e.mappedUnit, `${e.asnType}\n${e.kind}`, `${displayRank(e.rank)}\n${genderLabel(byNip.get(e.nip)!.gender, e.nip)}`, `${ageAt(e.birthDate, today) ?? "-"} / ${e.retirementAge ?? "-"}`, e.retirementTmt ?? "Belum diketahui"])),
    ] },
    { title: "LAMPIRAN II", subtitle: "Kebutuhan dan Proyeksi Keterisian Seluruh Jabatan", landscape: true, blocks: [
      paragraph(`${source.positions.length} penempatan berdasarkan Peta Jabatan DKPP 2026. Selisih = keterisian dikurangi kebutuhan; kekurangan bertanda minus. Pensiun periode hanya menghitung pegawai terpetakan. Sisa akhir tahun juga mengurangi TMT sebelum awal periode. Indentasi menunjukkan hierarki jabatan.`),
      table([col("No", .65, true), col("Jabatan", 4), col("Unit kerja", 3), col("Jenis", 1.2), col("Kebutuhan", 1, true), col("Aktif", .7, true), col("Selisih saat ini", 1.2, true), col(`Pensiun ${startYear}–${endYear}`, 1.4, true), col(`Sisa ${endYear}`, 1, true), col(`Selisih ${endYear}`, 1.2, true)],
        hierarchy.positions.map((node, i) => { const r = projection.rows.find(row => row.id === node.position.id)!; return [i + 1, r.name, r.unit, r.kind, r.required, r.active, r.active - r.required, r.totalRetirements, r.remaining[4], r.balance[4]]; }), hierarchy.positions.map(node => node.depth)),
    ] },
    { title: "LAMPIRAN III", subtitle: "Daftar Pegawai dalam Proyeksi Pensiun", landscape: true, blocks: [
      paragraph(`Periode ${startYear} sampai dengan ${endYear}, sebanyak ${projection.retirees.length} pegawai. Urutan berdasarkan TMT pensiun. Untuk PPPK, TMT menunjukkan proyeksi BUP jabatan dan bukan akhir kontrak. Penempatan yang belum cocok dengan peta diberi keterangan untuk verifikasi.`),
      table([col("No", .65, true), col("Nama dan NIP", 2.8), col("Jabatan", 3), col("Unit kerja", 2.8), col("Jenis ASN dan jabatan", 1.5), col("BUP", .6, true), col("TMT pensiun", 1.4, true), col("Keterangan", 1.7)],
        projection.retirees.map((e, i) => [i + 1, `${e.name}\n${e.nip}`, e.position, e.mappedUnit, `${e.asnType}\n${e.kind}`, e.retirementAge ?? "-", e.retirementTmt ?? "-", e.requirementId ? "Terpetakan" : "Verifikasi penempatan"])),
    ] },
  ];
  return { today, dateLabel, startYear, endYear, summary: { active: n, required: projection.required,
    mapped: projection.mappedActive, unmatched: projection.unmapped, retirees: projection.retirees.length, documented: documented.size }, sections };
}
