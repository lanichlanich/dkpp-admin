import type { Metadata } from "next";
import Link from "next/link";
import { FileSignature, Plus, Search } from "lucide-react";
import { z } from "zod";
import { requireMenuAccess } from "@/lib/authorization";
import { DISCIPLINE_MENU } from "@/lib/discipline-case";
import { getDisciplineCase, listDisciplineCases, listDisciplineEmployees } from "@/lib/discipline-cases";
import { DisciplineCaseForm } from "@/components/hukdis/discipline-case-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Penjatuhan Hukuman Disiplin" };
const pagePath = "/dashboard/penjatuhan-hukdis";
const perPage = 12;
const linkStyle = "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent focus-visible:outline-2";

export default async function DisciplineCasesPage({ searchParams }: {
  searchParams: Promise<{ perkara?: string; baru?: string; cari?: string; halaman?: string }>;
}) {
  await requireMenuAccess(DISCIPLINE_MENU);
  const query = await searchParams;
  const validId = z.uuid().safeParse(query.perkara);
  const creating = query.baru === "1";
  const [all, selected, employees] = await Promise.all([
    listDisciplineCases(),
    validId.success ? getDisciplineCase(validId.data) : undefined,
    validId.success || creating ? listDisciplineEmployees() : [],
  ]);
  const search = typeof query.cari === "string" ? query.cari.trim().slice(0, 100) : "";
  const matching = all.filter(row => `${row.reference} ${row.employee_name} ${row.employee_nip} ${row.status}`.toLocaleLowerCase("id-ID").includes(search.toLocaleLowerCase("id-ID")));
  const lastPage = Math.max(1, Math.ceil(matching.length / perPage));
  const candidate = Number(query.halaman);
  const current = Number.isInteger(candidate) && candidate > 0 ? Math.min(candidate, lastPage) : 1;
  const linkTo = (page: number) => `${pagePath}?cari=${encodeURIComponent(search)}&halaman=${page}`;

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-medium text-indigo-700">Kepegawaian</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Penjatuhan Hukuman Disiplin</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Kelola register perkara PNS, pemanggilan, pemeriksaan, keputusan, dan penyampaiannya. Draf Word menggunakan format lampiran dan kop DKPP.</p>
      </div>
      <Link href={`${pagePath}?baru=1`} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2">
        <Plus className="size-4" /> Tambah perkara
      </Link>
    </header>
    <details className="rounded-xl border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-medium">Acuan proses dan kewenangan</summary>
      <ul className="mt-3 list-disc space-y-2 pl-5 leading-6 text-muted-foreground">
        <li>Periksa kewajiban dan larangan, dampak, serta bukti sebelum memilih tingkat dan jenis hukuman. Pejabat berwenang ditentukan menurut jabatan, instansi, dan tingkat hukuman. Hukuman sedang memerlukan pemeriksaan ketentuan peralihan Pasal 42.</li>
        <li>Sampaikan panggilan tertulis paling lambat 7 hari kerja sebelum pemeriksaan. Bila PNS tidak hadir pada Panggilan I, lakukan Panggilan II paling lambat 7 hari kerja sejak jadwal pertama. Bila keduanya tidak dihadiri, catat alat bukti dan keterangan sebagai dasar.</li>
        <li>Pemeriksaan tertutup dituangkan dalam BAP. Untuk dugaan hukuman berat, tim pemeriksa wajib dibentuk. Untuk hukuman sedang, tim dapat dibentuk. Penolakan tanda tangan PNS dicatat pada BAP.</li>
        <li>Sampaikan keputusan paling lambat 14 hari kerja sejak penetapan. Catat tanggal diterima. Peraturan BKN menetapkan hari kerja ke-15 sejak diterima sebagai waktu berlaku. Jika ada keberatan atau banding, ikuti keputusan upaya administratif.</li>
        <li>Verifikasi tanggal terhadap kalender kerja instansi. Dokumentasikan keputusan dan bukti pemeriksaan untuk pengarsipan serta pencatatan di I’DIS BKN.</li>
      </ul>
      <p className="mt-3 flex flex-wrap gap-3 text-indigo-700">
        <a className="underline" href="https://peraturan.bpk.go.id/Details/177031/pp-no-94-tahun-2021">PP 94 Tahun 2021</a>
        <a className="underline" href="https://peraturan.bpk.go.id/Details/225406/peraturan-bkn-no-6-tahun-2022">Peraturan BKN 6 Tahun 2022</a>
        <a className="underline" href="https://peraturan.bpk.go.id/Details/175828/pp-no-79-tahun-2021">PP 79 Tahun 2021</a>
      </p>
    </details>

    {query.perkara && !selected && <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Perkara yang dipilih tidak ditemukan.</p>}
    {(creating || selected) && <DisciplineCaseForm key={creating ? "baru" : selected?.id} initial={creating ? undefined : selected} employees={employees} />}
    <section aria-labelledby="register-hukdis" className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="register-hukdis" className="flex items-center gap-2 font-semibold"><FileSignature className="size-4 text-indigo-700" /> Register perkara</h2>
        <p className="text-sm text-muted-foreground">{matching.length} perkara</p>
      </div>
      <form method="get" action={pagePath} className="flex max-w-xl gap-2">
        <Input name="cari" aria-label="Cari perkara" maxLength={100} placeholder="Nama, NIP, nomor register, atau status" defaultValue={search} />
        <Button variant="outline" type="submit"><Search /> Cari</Button>
      </form>
      {matching.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">{search ? "Perkara tidak ditemukan untuk pencarian ini." : "Belum ada perkara disiplin dalam register."}</p>
        : <div className="divide-y rounded-lg border">{matching.slice((current - 1) * perPage, current * perPage).map(row =>
          <Link key={row.id} href={`${pagePath}?perkara=${row.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-3 text-sm hover:bg-accent">
            <span><span className="block font-medium">{row.reference} · {row.employee_name}</span><span className="text-xs text-muted-foreground">{row.employee_nip}</span></span>
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-900">{row.status}</span>
          </Link>)}</div>}
      {lastPage > 1 && <nav aria-label="Halaman register" className="flex items-center justify-between gap-2 text-sm">
        {current > 1 ? <Link href={linkTo(current - 1)} className={linkStyle}>Sebelumnya</Link> : <span />}
        <span>Halaman {current} dari {lastPage}</span>
        {current < lastPage ? <Link href={linkTo(current + 1)} className={linkStyle}>Berikutnya</Link> : <span />}
      </nav>}
    </section>
  </div>;
}
