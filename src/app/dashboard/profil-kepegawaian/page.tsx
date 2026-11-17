import type { Metadata } from "next";
import { Building2, CalendarClock, Download, FileBarChart2, FileText, UsersRound } from "lucide-react";
import { requireMenuAccess } from "@/lib/authorization";
import { getStaffProfileData } from "@/lib/staff-profile-data";
import { buildStaffProfile, PROFILE_CHAPTERS } from "@/lib/staff-profile";
import { jakartaToday } from "@/lib/plt-dates";

export const metadata: Metadata = { title: "Profil Kepegawaian Dinas" };
export default async function StaffProfilePage({ searchParams }: { searchParams: Promise<{ tahun?: string }> }) {
  await requireMenuAccess("profil-kepegawaian");
  const today = jakartaToday(), defaultYear = Number(today.slice(0, 4)) + 1;
  const { tahun } = await searchParams;
  const year = tahun && /^\d{4}$/.test(tahun) && Number(tahun) >= 2000 && Number(tahun) <= 2095 ? Number(tahun) : defaultYear;
  const report = buildStaffProfile(await getStaffProfileData(), today, year);
  const cards = [
    { title: "Pegawai aktif", value: report.summary.active, icon: UsersRound },
    { title: "Kebutuhan peta jabatan", value: report.summary.required, icon: Building2 },
    { title: "Pegawai terpetakan", value: report.summary.mapped, icon: FileBarChart2 },
    { title: `Proyeksi pensiun ${year}–${year + 4}`, value: report.summary.retirees, icon: CalendarClock },
  ];
  return <div className="mx-auto min-w-0 max-w-6xl space-y-6">
    <div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-100 p-3 text-indigo-700"><FileBarChart2 className="size-6" /></div>
      <div><p className="text-sm font-medium text-indigo-600">Kepegawaian</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Profil Kepegawaian Dinas</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Profil lengkap DKPP Kabupaten Indramayu dalam tujuh bab dan tiga lampiran. Disusun dari data aplikasi dengan tata naskah formal, hierarki judul, tabel rinci, dan nomor halaman.</p></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => <div key={card.title} className="rounded-xl border bg-white p-5 dark:bg-zinc-950"><card.icon className="mb-3 size-5 text-indigo-600" /><p className="text-sm text-zinc-500">{card.title}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{card.value}</p></div>)}</div>
    <section className="rounded-xl border bg-white p-5 md:p-7 dark:bg-zinc-950" aria-labelledby="download-title">
      <h2 id="download-title" className="text-lg font-semibold">Unduh profil kepegawaian</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-500">Keadaan data per <strong className="font-medium text-zinc-800 dark:text-zinc-200">{report.dateLabel}</strong>. PDF siap dicetak dan DOCX dapat disunting. Kedua format memuat isi dan angka yang sama.</p>
      <form action="/dashboard/profil-kepegawaian" className="my-5 flex flex-wrap items-end gap-3"><div><label htmlFor="profile-year" className="mb-1.5 block text-sm font-medium">Tahun awal proyeksi pensiun</label><input id="profile-year" name="tahun" type="number" min={2000} max={2095} defaultValue={year} required className="h-10 w-36 rounded-lg border bg-transparent px-3 text-sm" /></div><button type="submit" className="h-10 rounded-lg border px-4 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">Terapkan periode</button><p className="w-full text-xs leading-5 text-zinc-500">Periode proyeksi {year}–{year + 4}. Tahun proyeksi tidak mengubah tanggal keadaan data pegawai.</p></form>
      <div className="flex flex-col gap-3 sm:flex-row"><a download href={`/api/staff-profile/export?format=pdf&startYear=${year}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"><Download className="size-4" />Unduh PDF</a><a download href={`/api/staff-profile/export?format=docx&startYear=${year}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"><FileText className="size-4" />Unduh DOCX</a></div>
    </section>
    <section className="rounded-xl border bg-white p-5 md:p-7 dark:bg-zinc-950" aria-labelledby="contents-title"><h2 id="contents-title" className="text-lg font-semibold">Isi dokumen</h2><ol className="mt-5 grid gap-4 md:grid-cols-2">{PROFILE_CHAPTERS.map((chapter, i) => <li key={chapter} className="flex gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700 dark:bg-indigo-950">{i + 1}</span><div><p className="pt-1 text-sm font-medium">{chapter}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{[
      "Tujuan, ruang lingkup, sumber data, dan metode penyusunan.", "Hierarki unit serta jumlah pegawai langsung dan seluruh turunannya.", "Jenis ASN, jenis dan jenjang jabatan, jenis kelamin, usia, dan golongan PNS.", "Perbandingan kebutuhan, keterisian, kekurangan, dan kelebihan tiap penempatan.", `Rekap tahunan dan dampak pensiun terhadap keterisian ${year}–${year + 4}.`,
      "Arsip pegawai, KGB bertanda tangan, penugasan Plt., dan kelengkapan data.", "Kesimpulan berdasarkan data dan tindak lanjut administrasi.",
    ][i]}</p></div></li>)}</ol><div className="mt-6 border-t pt-5"><h3 className="text-sm font-semibold">Lampiran lengkap</h3><ul className="mt-2 space-y-1 text-sm leading-6 text-zinc-500"><li>I. Daftar seluruh pegawai aktif beserta NIP, jabatan, unit, dan proyeksi TMT pensiun.</li><li>II. Seluruh penempatan peta jabatan dengan kebutuhan, keterisian, dan selisih.</li><li>III. Daftar pegawai dalam periode proyeksi pensiun.</li></ul></div></section>
  </div>;
}
