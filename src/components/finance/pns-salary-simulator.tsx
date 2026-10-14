"use client";

import { useState, type ReactNode } from "react";
import { Calculator, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculatePnsPayroll, DEFAULT_PNS_PAYROLL, PNS_GRADES, salaryYears, STRUCTURAL_ALLOWANCES, type PayrollExtra, type PayrollLine, type PnsPayrollInput } from "@/lib/pns-payroll";

const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";
function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label>{children}{hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}</div>;
}
function Amount({ id, label, value, onChange, hint }: { id: string; label: string; value: number; onChange: (value: number) => void; hint?: string }) {
  return <Field id={id} label={label} hint={hint}><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-muted-foreground">Rp</span><input id={id} className={`${inputClass} pl-10`} type="number" min={0} max={1_000_000_000} step={1} value={Number.isNaN(value) ? "" : value} onChange={event => onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))} /></div></Field>;
}
function Check({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"><input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-emerald-600" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{children}</span></label>;
}
function ExtraRows({ kind, rows, onChange }: { kind: "allowances" | "deductions"; rows: PayrollExtra[]; onChange: (rows: PayrollExtra[]) => void }) {
  const allowance = kind === "allowances";
  const update = (index: number, value: Partial<PayrollExtra>) => onChange(rows.map((row, i) => i === index ? { ...row, ...value } : row));
  return <div className="space-y-3">
    {rows.map((row, i) => <div key={i} className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Field id={`${kind}-name-${i}`} label={`Nama ${allowance ? "tunjangan" : "potongan"} ${i + 1}`}><input id={`${kind}-name-${i}`} className={inputClass} maxLength={120} placeholder={allowance ? "Contoh: tunjangan risiko" : "Contoh: cicilan koperasi"} value={row.name} onChange={event => update(i, { name: event.target.value })} /></Field>
        <Amount id={`${kind}-amount-${i}`} label="Nominal" value={row.amount} onChange={amount => update(i, { amount })} />
        <Button variant="ghost" size="icon" className="self-end text-red-600" aria-label={`Hapus ${allowance ? "tunjangan" : "potongan"} ${i + 1}`} onClick={() => onChange(rows.filter((_, index) => index !== i))}><Trash2 className="size-4" /></Button>
      </div>
      {allowance && <Check id={`${kind}-bpjs-${i}`} checked={Boolean(row.bpjsBase)} onChange={bpjsBase => update(i, { bpjsBase })}>Termasuk dasar iuran BPJS sesuai ketentuan/slip</Check>}
    </div>)}
    <Button type="button" variant="outline" disabled={rows.length >= 30} onClick={() => onChange([...rows, { name: "", amount: 0, bpjsBase: false }])}><Plus className="size-4" />Tambah {allowance ? "tunjangan" : "potongan"}</Button>
  </div>;
}
function Breakdown({ title, lines, total }: { title: string; lines: PayrollLine[]; total: number }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>
    <dl className="divide-y">{lines.map((row, i) => <div key={`${row.name}-${i}`} className="flex items-start justify-between gap-4 py-3 first:pt-0"><dt className="min-w-0"><p className="text-sm font-medium">{row.name}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{row.explanation}</p></dt><dd className="shrink-0 text-sm font-medium tabular-nums">{rupiah(row.amount)}</dd></div>)}<div className="flex justify-between gap-3 pt-4 font-semibold"><dt>Total {title.toLowerCase()}</dt><dd className="tabular-nums">{rupiah(total)}</dd></div></dl>
  </CardContent></Card>;
}
export function PnsSalarySimulator() {
  const [input, setInput] = useState<PnsPayrollInput>(DEFAULT_PNS_PAYROLL);
  const update = <K extends keyof PnsPayrollInput>(key: K, value: PnsPayrollInput[K]) => setInput(previous => ({ ...previous, [key]: value }));
  let result: ReturnType<typeof calculatePnsPayroll> | null = null;
  let error = "";
  try { result = calculatePnsPayroll(input); } catch (cause) { error = cause instanceof Error ? cause.message : "Periksa kembali isian simulasi."; }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><div className="flex items-center gap-3"><Calculator className="size-5" /><span className="text-sm">Simulasi gaji bulanan PNS · Golongan I/a–IV/e</span></div><Button type="button" variant="outline" onClick={() => setInput({ ...DEFAULT_PNS_PAYROLL, allowances: [], deductions: [] })}><RotateCcw className="size-4" />Reset simulasi</Button></div>
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        <Card><CardHeader><CardTitle>Gaji pokok dan keluarga</CardTitle></CardHeader><CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="salary-grade" label="Golongan"><select id="salary-grade" className={inputClass} value={input.grade} onChange={event => { const grade = event.target.value; const years = salaryYears(grade); setInput(previous => ({ ...previous, grade, years: years.includes(previous.years) ? previous.years : years[0] })); }}>{PNS_GRADES.map(grade => <option key={grade}>{grade}</option>)}</select></Field>
            <Field id="salary-years" label="MKG (tahun)"><select id="salary-years" className={inputClass} value={input.years} onChange={event => update("years", Number(event.target.value))}>{salaryYears(input.grade).map(year => <option key={year} value={year}>{year} tahun</option>)}</select></Field>
            <Field id="salary-months" label="MKG (bulan)"><select id="salary-months" className={inputClass} value={input.months} onChange={event => update("months", Number(event.target.value))}>{Array.from({ length: 12 }, (_, month) => <option key={month} value={month}>{month} bulan</option>)}</select></Field>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">Gunakan MKG yang tercantum dalam SK gaji/KGB. Bulan belum genap satu tahun tidak menaikkan gaji pokok.</p>
          <Check id="salary-spouse" checked={input.spouse} onChange={value => update("spouse", value)}>Tunjangan istri/suami (10% gaji pokok)<span className="mt-1 block text-xs text-muted-foreground">Aktifkan jika hak tunjangan dibayarkan pada pegawai ini; pasangan sesama ASN tidak menerima tunjangan keluarga ganda.</span></Check>
          <Field id="salary-children" label="Anak yang mendapat tunjangan" hint="Maksimal 2 anak untuk ketentuan umum, belum menikah/tidak berpenghasilan, memenuhi syarat umur atau pendidikan."><select id="salary-children" className={inputClass} value={input.children} onChange={event => update("children", Number(event.target.value))}>{[0, 1, 2].map(count => <option key={count} value={count}>{count} anak</option>)}</select></Field>
          <Check id="salary-rice" checked={input.riceInCash} onChange={value => update("riceInCash", value)}>Tunjangan beras dibayar tunai (Rp72.420 per jiwa)<span className="mt-1 block text-xs text-muted-foreground">Pegawai + pasangan yang ditanggung + anak yang mendapat tunjangan. Nonaktifkan jika beras diberikan dalam bentuk natura.</span></Check>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Tunjangan jabatan dan tambahan</CardTitle></CardHeader><CardContent className="space-y-5">
          <Field id="salary-job" label="Jenis tunjangan jabatan" hint="Tunjangan umum, struktural, dan fungsional dihitung salah satu, sesuai hak pegawai."><select id="salary-job" className={inputClass} value={input.job} onChange={event => update("job", event.target.value as PnsPayrollInput["job"])}><option value="umum">Pelaksana / tunjangan umum</option><option value="struktural">Struktural (JS)</option><option value="fungsional">Fungsional (JF)</option><option value="tanpa">Tidak menerima tunjangan jabatan/umum</option></select></Field>
          {input.job === "struktural" && <Field id="salary-echelon" label="Eselon"><select id="salary-echelon" className={inputClass} value={input.echelon} onChange={event => update("echelon", event.target.value)}>{Object.entries(STRUCTURAL_ALLOWANCES).map(([echelon, amount]) => <option key={echelon} value={echelon}>{echelon} — {rupiah(amount)}</option>)}</select></Field>}
          {input.job === "fungsional" && <Amount id="salary-functional" label="Tunjangan fungsional" value={input.functionalAllowance} onChange={value => update("functionalAllowance", value)} hint="Isi sesuai Perpres/SK jenis dan jenjang jabatan fungsional pegawai." />}
          <Amount id="salary-profession" label="Tunjangan profesi (jika berhak)" value={input.professionalAllowance} onChange={value => update("professionalAllowance", value)} hint="Isi nominal bulanan sesuai hak profesi, bukan TPP/tukin." />
          <div className="grid gap-4 sm:grid-cols-2"><Field id="salary-meal-days" label="Hari uang makan"><input id="salary-meal-days" className={inputClass} type="number" min={0} max={31} step={1} value={Number.isNaN(input.mealDays) ? "" : input.mealDays} onChange={event => update("mealDays", event.target.value === "" ? Number.NaN : Number(event.target.value))} /></Field><Amount id="salary-meal-rate" label="Tarif uang makan per hari" value={input.mealRate} onChange={value => update("mealRate", value)} /></div>
          <p className="text-xs leading-5 text-muted-foreground">Uang makan hanya dihitung jika diberikan instansi. Gunakan tarif dan hari yang berhak dibayar; pajak yang dibebankan dapat diisi pada bagian potongan.</p>
          <ExtraRows kind="allowances" rows={input.allowances} onChange={rows => update("allowances", rows)} />
          <Amount id="salary-rounding" label="Pembulatan sesuai slip (opsional)" value={input.rounding} onChange={value => update("rounding", value)} />
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Potongan</CardTitle></CardHeader><CardContent className="space-y-5">
          <p className="rounded-lg bg-muted/50 p-3 text-xs leading-5">Pensiun 4,75% dan THT 3,25% dari gaji pokok + tunjangan keluarga dihitung otomatis. BPJS pegawai 1% dari dasar iuran, maksimal dasar Rp12 juta.</p>
          <Field id="salary-bpjs-base" label="Dasar BPJS sesuai slip (opsional)" hint="Kosongkan untuk otomatis: gaji pokok + keluarga + jabatan/umum + profesi + tambahan yang ditandai. Jika dasar BPJS juga mencakup TPP/tukin, isi dasar lengkap dari slip; TPP/tukin tetap tidak ditambahkan ke penghasilan simulasi."><input id="salary-bpjs-base" className={inputClass} type="number" min={1} max={1_000_000_000} step={1} placeholder="Otomatis dari komponen gaji" value={input.bpjsBaseOverride === null || Number.isNaN(input.bpjsBaseOverride) ? "" : input.bpjsBaseOverride} onChange={event => update("bpjsBaseOverride", event.target.value === "" ? null : Number(event.target.value))} /></Field>
          <Field id="salary-bpjs-family" label="Peserta BPJS keluarga tambahan" hint="Isi hanya anggota keluarga lain yang dikenai iuran tambahan 1% per orang; bukan pasangan/anak dalam kepesertaan utama."><input id="salary-bpjs-family" className={inputClass} type="number" min={0} max={10} step={1} value={Number.isNaN(input.additionalBpjsMembers) ? "" : input.additionalBpjsMembers} onChange={event => update("additionalBpjsMembers", event.target.value === "" ? Number.NaN : Number(event.target.value))} /></Field>
          <Amount id="salary-tapera" label="Potongan Tapera (jika berlaku)" value={input.tapera} onChange={value => update("tapera", value)} hint="Isi nominal yang benar-benar dipotong pada slip sesuai kepesertaan dan ketentuan yang berlaku." />
          <Amount id="salary-tax" label="PPh 21 yang dibebankan pegawai" value={input.cashTax} onChange={value => update("cashTax", value)} hint="Default Rp0: PPh 21 atas gaji/tunjangan tetap dan teratur PNS dari APBN/APBD ditanggung pemerintah (PP No. 80 Tahun 2010). Isi hanya pajak yang benar-benar dibebankan, misalnya atas pembayaran lain. Fitur ini tidak menghitung TER atau rekonsiliasi pajak tahunan." />
          <Check id="salary-korpri" checked={input.korpri} onChange={value => update("korpri", value)}>Potongan KORPRI Rp100.000 per bulan (opsional)</Check>
          <ExtraRows kind="deductions" rows={input.deductions} onChange={rows => update("deductions", rows)} />
        </CardContent></Card>
      </div>
      <div className="space-y-6">
        {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<p className="mt-2">Hasil disembunyikan sampai isian valid.</p></div> : result && <>
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-sky-700 p-6 text-white shadow-sm"><p className="text-sm text-emerald-50">Estimasi diterima per bulan</p><p data-testid="salary-net" className="mt-2 break-words text-3xl font-semibold tracking-tight tabular-nums">{rupiah(result.net)}</p><p className="mt-2 text-xs text-emerald-50">Penghasilan dikurangi potongan · tanpa TPP/tukin</p><div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/20 pt-4"><div><p className="text-xs text-emerald-50">Penghasilan</p><p data-testid="salary-gross" className="mt-1 font-medium tabular-nums">{rupiah(result.gross)}</p></div><div><p className="text-xs text-emerald-50">Potongan</p><p data-testid="salary-deductions" className="mt-1 font-medium tabular-nums">{rupiah(result.totalDeductions)}</p></div></div></div>
          {result.net < 0 && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Potongan melebihi penghasilan yang disimulasikan. Periksa nominal dan komponen yang diisi.</p>}
          <Breakdown title="Penghasilan" lines={result.income} total={result.gross} />
          <Breakdown title="Potongan" lines={result.deductions} total={result.totalDeductions} />
        </>}
        <Card><CardHeader><CardTitle>Dasar perhitungan</CardTitle></CardHeader><CardContent className="space-y-3 text-xs leading-5 text-muted-foreground">
          <p>Gaji pokok menggunakan Lampiran I Peraturan BKN No. 1 Tahun 2024 (tabel PP No. 5 Tahun 2024). Simulasi untuk gaji rutin PNS aktif; tunjangan khusus, uang makan, dan potongan tambahan mengikuti kondisi pegawai/SK/slip. THR dan gaji ke-13 tidak masuk simulasi bulanan.</p>
          <p>Iuran pemberi kerja tidak dibebankan lagi kepada pegawai. Nominal dibulatkan ke rupiah; selisih pembulatan slip dapat disesuaikan. Perhitungan keluarga menggunakan ketentuan umum maksimal 2 anak.</p>
          <ul className="space-y-2 underline underline-offset-2">
            <li><a href="https://peraturan.bpk.go.id/Details/276755/pp-no-5-tahun-2024" target="_blank" rel="noreferrer">PP No. 5 Tahun 2024 — gaji pokok</a></li>
            <li><a href="https://lldikti5.kemdiktisaintek.go.id/home/detailpost/ketentuan-tunjangan-istrisuami-dan-anak" target="_blank" rel="noreferrer">Ketentuan tunjangan keluarga</a></li>
            <li><a href="https://jdih.kemenkeu.go.id/api/download/fulltext/2006/12tahun2006perpres.htm" target="_blank" rel="noreferrer">Perpres No. 12 Tahun 2006 — tunjangan umum</a></li>
            <li><a href="https://peraturan.go.id/files/ps26-2007.pdf" target="_blank" rel="noreferrer">Perpres No. 26 Tahun 2007 — tunjangan struktural</a></li>
            <li><a href="https://www.kemhan.go.id/itjen/2015/02/12/tunjangan-beras-pns-tni-dan-polri-naik-38-persen.html" target="_blank" rel="noreferrer">PER-3/PB/2015 — tarif tunjangan beras</a></li>
            <li><a href="https://sumsel.bpk.go.id/2024/11/06/pt-taspen-tawarkan-asuransi-kepada-pppk-bpk/" target="_blank" rel="noreferrer">TASPEN — iuran pensiun dan THT</a></li>
            <li><a href="https://peraturan.bpk.go.id/details/285181/perpres-no-59-tahun-2024" target="_blank" rel="noreferrer">Perpres No. 82 Tahun 2018 beserta perubahan — BPJS Kesehatan</a></li>
            <li><a href="https://jdih.kemenkeu.go.id/dok/pp-80-tahun-2010/view" target="_blank" rel="noreferrer">PP No. 80 Tahun 2010 — PPh 21 gaji rutin ditanggung pemerintah</a></li>
          </ul>
        </CardContent></Card>
      </div>
    </div>
  </div>;
}
