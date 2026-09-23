"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Download, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PakEmployeeOption } from "@/lib/employees";
import { calculatePak, convertCredit, emptyPakComponents, formatCredit, inferPakLevel, pakComponentLabels, pakLevels, pakMonths, pakPredicates, periodLabel, type PakComponent, type PakHistory, type PakLevel, type PakPeriod, type PakPredicate } from "@/lib/pak";
import { pakSchema, type PakInput } from "@/lib/pak-validation";
import { getBirthDateIsoFromNip } from "@/lib/retirement-age";

const selectClass = "h-10 w-full min-w-0 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50";
const numericValue = (value: number) => Number.isFinite(value) ? value : "";
const parseNumber = (value: string) => value === "" ? Number.NaN : Number(value);
type Errors = Record<string, string>;

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label>{children}{error && <p id={`${id}-error`} className="text-xs text-destructive" role="alert">{error}</p>}</div>;
}

function PeriodFields({ value, onChange, prefix, errors }: { value: PakPeriod; onChange: (value: PakPeriod) => void; prefix: string; errors: Errors }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
    <Field id={`${prefix}.year`} label="Tahun" error={errors[`${prefix}.year`]}><Input id={`${prefix}.year`} type="number" min={1900} max={2100} value={numericValue(value.year)} onChange={(e) => onChange({ ...value, year: parseNumber(e.target.value) })} /></Field>
    {(["startMonth", "endMonth"] as const).map((key) => <Field key={key} id={`${prefix}.${key}`} label={key === "startMonth" ? "Bulan awal" : "Bulan akhir"} error={errors[`${prefix}.${key}`]}><select id={`${prefix}.${key}`} className={selectClass} value={value[key]} onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })}>{pakMonths.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></Field>)}
    <Field id={`${prefix}.level`} label="Jenjang JF" error={errors[`${prefix}.level`]}><select id={`${prefix}.level`} className={selectClass} value={value.level} onChange={(e) => onChange({ ...value, level: e.target.value as PakLevel })}><option value="">Pilih jenjang</option>{Object.keys(pakLevels).map((level) => <option key={level}>{level}</option>)}</select></Field>
    <Field id={`${prefix}.predicate`} label="Predikat kinerja" error={errors[`${prefix}.predicate`]}><select id={`${prefix}.predicate`} className={selectClass} value={value.predicate} onChange={(e) => onChange({ ...value, predicate: e.target.value as PakPredicate })}><option value="">Pilih predikat</option>{Object.keys(pakPredicates).map((predicate) => <option key={predicate}>{predicate}</option>)}</select></Field>
  </div>;
}

export function PakForm({ employees, today }: { employees: PakEmployeeOption[]; today: string }) {
  const [nip, setNip] = useState("");
  const [status, setStatus] = useState("Semua");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const selected = employees.find((e) => e.nip === nip);
  const filtered = employees.filter((e) => status === "Semua" || e.status === status);
  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>Pegawai yang dinilai</CardTitle><CardDescription>PNS aktif, mutasi, dan pensiun tersedia. Gunakan jabatan fungsional yang diduduki pada periode penilaian.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <Field id="pak-status" label="Filter status"><select id="pak-status" value={status} disabled={busy} onChange={(e) => setStatus(e.target.value)} className={selectClass}>{["Semua", "Aktif", "Mutasi", "Pensiun"].map((s) => <option key={s} value={s}>{s} ({employees.filter((e) => s === "Semua" || e.status === s).length})</option>)}</select></Field>
        <Field id="pak-employee" label="Nama / NIP pegawai"><Popover open={open} onOpenChange={setOpen}><PopoverTrigger render={<Button id="pak-employee" type="button" variant="outline" role="combobox" aria-expanded={open} disabled={busy} className="h-10 w-full justify-between overflow-hidden font-normal" />}><span className="truncate">{selected ? `${selected.name} · ${selected.nip} · ${selected.status}` : "Pilih pegawai"}</span><ChevronsUpDown className="size-4 shrink-0" /></PopoverTrigger><PopoverContent align="start" className="w-[var(--anchor-width)] p-0"><Command><CommandInput placeholder="Cari nama, NIP, jabatan..." /><CommandList><CommandEmpty>Pegawai tidak ditemukan.</CommandEmpty><CommandGroup>{filtered.map((employee) => <CommandItem key={employee.nip} value={`${employee.name} ${employee.nip} ${employee.position} ${employee.status}`} onSelect={() => { setNip(employee.nip); setOpen(false); }}><Check className={`size-4 ${nip === employee.nip ? "opacity-100" : "opacity-0"}`} /><span className="min-w-0"><span className="block truncate">{employee.name}</span><span className="block truncate text-xs text-muted-foreground">{employee.nip} · {employee.status} · {employee.position}</span></span></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover></Field>
      </div>
      {selected && <div className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950"><strong>Status saat ini: {selected.status}.</strong> Pangkat dan jabatan awal berasal dari database saat ini. Cocokkan dengan SK pada periode PAK; perubahan isian di sini hanya berlaku untuk dokumen ini.{selected.positionType !== "JF" && " Jabatan saat ini bukan JF; isi jabatan fungsional historis beserta TMT-nya."} Mengganti pegawai akan mengosongkan isian PAK sebelumnya.</div>}
    </CardContent></Card>
    {selected ? <PakEditor key={selected.nip} employee={selected} employees={employees} today={today} onBusy={setBusy} /> : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-zinc-500">Pilih pegawai untuk mulai menyusun PAK.</p>}
  </div>;
}

function initialValues(employee: PakEmployeeOption, today: string): PakInput {
  const [golongan, ...rank] = employee.rank.split(/\s+\/\s+/);
  const level = inferPakLevel(employee.position);
  return {
    nip: employee.nip, nomor: "", tanggal: today, tempatPenetapan: "Indramayu", instansi: "Pemerintah Kab. Indramayu",
    kartuAsn: "", tempatLahir: "", tanggalLahir: getBirthDateIsoFromNip(employee.nip) ?? "", jenisKelamin: employee.nip[14] === "2" ? "Wanita" : "Pria",
    pangkat: rank.join(" / "), golongan: golongan as PakInput["golongan"], tmtPangkat: "", jabatan: employee.position, tmtJabatan: "", unitKerja: employee.unit,
    penilaiNama: "", penilaiNip: "",
    period: { year: Number(today.slice(0, 4)) - 1, startMonth: 1, endMonth: 12, level: level as PakLevel, predicate: "" as PakPredicate },
    history: [], components: emptyPakComponents(), rankMinimum: level ? pakLevels[level].rankMinimum : Number.NaN, levelMinimum: level ? pakLevels[level].levelMinimum : null,
  };
}

function PakEditor({ employee, employees, today, onBusy }: { employee: PakEmployeeOption; employees: PakEmployeeOption[]; today: string; onBusy: (busy: boolean) => void }) {
  const router = useRouter();
  const [values, setValues] = useState(() => initialValues(employee, today));
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState("");
  function setValue<K extends keyof PakInput>(key: K, value: PakInput[K]) { setValues((v) => ({ ...v, [key]: value })); setErrors({}); setFailure(""); }
  const canCalculate = Boolean(pakLevels[values.period.level] && pakPredicates[values.period.predicate] && values.period.endMonth >= values.period.startMonth && Object.values(values.components).every((r) => Number.isFinite(r.old) && Number.isFinite(r.new)) && values.history.every((r) => r.kind === "integrasi" ? Number.isFinite(r.credit) : pakLevels[r.level] && pakPredicates[r.predicate] && r.endMonth >= r.startMonth));
  const calculation = canCalculate ? calculatePak(values) : null;
  const field = (key: keyof PakInput, label: string, type = "text") => <Field key={key} id={key} label={label} error={errors[key]}><Input id={key} type={type} value={String(values[key] ?? "")} onChange={(e) => setValue(key, e.target.value as never)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined} /></Field>;
  function updateHistory(index: number, row: PakHistory) { setValue("history", values.history.map((value, i) => i === index ? row : value)); }
  function addHistory(kind: "integrasi" | "konversi") {
    setValue("history", [...values.history, kind === "integrasi" ? { kind, year: values.period.year - 1, credit: Number.NaN } : { ...values.period, kind, year: values.period.year - 1, startMonth: 1, endMonth: 12, predicate: "" as PakPredicate }]);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = pakSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
      setFailure("Periksa kembali isian yang ditandai. Semua identitas, periode, dan penilai wajib dilengkapi.");
      document.getElementById(parsed.error.issues[0].path.join("."))?.focus();
      return;
    }
    setSubmitting(true); onBusy(true); setFailure(""); setErrors({});
    try {
      const response = await fetch("/api/pak/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      if (!response.ok) {
        const result = await response.json();
        if (Array.isArray(result.errors)) setErrors(Object.fromEntries(result.errors.map((e: { path: string; message: string }) => [e.path, e.message])));
        throw new Error(result.message ?? "PAK gagal dibuat.");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `PAK-${employee.nip}.docx`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("PAK dibuat dan disimpan ke daftar dokumen."); router.refresh();
    } catch (error) { setFailure(error instanceof Error ? error.message : "PAK gagal dibuat."); }
    finally { setSubmitting(false); onBusy(false); }
  }
  return <form onSubmit={submit} noValidate className="space-y-6"><fieldset disabled={submitting} className="min-w-0 space-y-6">
    <Card><CardHeader><CardTitle>Identitas pada periode penilaian</CardTitle><CardDescription>Nama dan NIP: {employee.name} · {employee.nip}. Isi data sesuai SK dan kartu ASN. Tanggal lahir dan jenis kelamin disarankan dari NIP.</CardDescription></CardHeader><CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {field("kartuAsn", "Nomor kartu ASN / KARPEG")}{field("tempatLahir", "Tempat lahir")}{field("tanggalLahir", "Tanggal lahir", "date")}
      <Field id="jenisKelamin" label="Jenis kelamin"><select id="jenisKelamin" className={selectClass} value={values.jenisKelamin} onChange={(e) => setValue("jenisKelamin", e.target.value as "Pria" | "Wanita")}><option>Pria</option><option>Wanita</option></select></Field>
      {field("pangkat", "Pangkat pada periode PAK")}
      <Field id="golongan" label="Golongan ruang" error={errors.golongan}><select id="golongan" className={selectClass} value={values.golongan} onChange={(e) => setValue("golongan", e.target.value as PakInput["golongan"])}><option value="">Pilih golongan</option>{["I/a", "I/b", "I/c", "I/d", "II/a", "II/b", "II/c", "II/d", "III/a", "III/b", "III/c", "III/d", "IV/a", "IV/b", "IV/c", "IV/d", "IV/e"].map((g) => <option key={g}>{g}</option>)}</select></Field>
      {field("tmtPangkat", "TMT pangkat", "date")}{field("jabatan", "Jabatan fungsional pada periode PAK")}{field("tmtJabatan", "TMT jabatan", "date")}{field("unitKerja", "Unit kerja pada periode PAK")}{field("instansi", "Instansi pada periode PAK")}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Konversi kinerja periode baru</CardTitle><CardDescription>AK = jumlah bulan ÷ 12 × persentase predikat × koefisien jenjang. Hasil dibulatkan tiga desimal per baris.</CardDescription></CardHeader><CardContent className="space-y-4"><PeriodFields value={values.period} prefix="period" errors={errors} onChange={(period) => {
      setValue("period", period);
      if (period.level !== values.period.level && pakLevels[period.level]) setValues((v) => ({ ...v, rankMinimum: pakLevels[period.level].rankMinimum, levelMinimum: pakLevels[period.level].levelMinimum }));
    }} />{calculation && <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950">{periodLabel(values.period)} {values.period.year}: {values.period.endMonth - values.period.startMonth + 1}/12 × {pakPredicates[values.period.predicate]}% × {formatCredit(pakLevels[values.period.level].coefficient)} = <strong>{formatCredit(calculation.newConversion)} AK</strong></p>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Riwayat akumulasi angka kredit</CardTitle><CardDescription>Masukkan saldo AK integrasi dari dokumen lama bila ada, lalu riwayat konversi sesudahnya. Periode baru ditambahkan otomatis. Jangan masukkan saldo yang sama dua kali.</CardDescription></CardHeader><CardContent className="space-y-4">
      {values.history.length === 0 && <p className="text-sm text-zinc-500">Belum ada riwayat. Tambahkan bila pegawai memiliki AK sebelumnya.</p>}
      {errors.history && <p role="alert" className="text-sm text-destructive">{errors.history}</p>}
      {values.history.map((row, i) => <div key={i} className="space-y-4 rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{i + 1}. {row.kind === "integrasi" ? "Saldo AK Integrasi" : "Konversi terdahulu"}</h3><Button variant="ghost" size="sm" type="button" aria-label={`Hapus riwayat ${i + 1}`} onClick={() => setValue("history", values.history.filter((_, n) => n !== i))}><Trash2 className="size-4" />Hapus</Button></div>
        {row.kind === "integrasi" ? <div className="grid gap-4 sm:grid-cols-2"><Field id={`history.${i}.year`} label="Tahun saldo integrasi" error={errors[`history.${i}.year`]}><Input id={`history.${i}.year`} type="number" value={numericValue(row.year)} onChange={(e) => updateHistory(i, { ...row, year: parseNumber(e.target.value) })} /></Field><Field id={`history.${i}.credit`} label="Angka kredit integrasi" error={errors[`history.${i}.credit`]}><Input id={`history.${i}.credit`} type="number" min={0} step="0.001" value={numericValue(row.credit)} onChange={(e) => updateHistory(i, { ...row, credit: parseNumber(e.target.value) })} /></Field></div> : <><PeriodFields prefix={`history.${i}`} errors={errors} value={row} onChange={(period) => updateHistory(i, { ...period, kind: "konversi" })} />{pakLevels[row.level] && pakPredicates[row.predicate] && <p className="text-sm text-zinc-600">Hasil konversi: {formatCredit(convertCredit(row))} AK</p>}</>}
        {errors[`history.${i}`] && <p role="alert" className="text-sm text-destructive">{errors[`history.${i}`]}</p>}
      </div>)}
      <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" disabled={values.history.some((r) => r.kind === "integrasi") || values.history.length >= 24} onClick={() => addHistory("integrasi")}><Plus />Saldo integrasi</Button><Button type="button" variant="outline" disabled={values.history.length >= 24} onClick={() => addHistory("konversi")}><Plus />Riwayat konversi</Button></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Komponen penetapan angka kredit</CardTitle><CardDescription>AK konversi lama dan baru dihitung dari riwayat di atas. Komponen lain diisi hanya bila tercantum pada dasar penetapannya; nilai awal nol.</CardDescription></CardHeader><CardContent className="space-y-4">
      <p className="text-sm">AK konversi: lama <strong>{calculation ? formatCredit(calculation.oldConversion) : "—"}</strong> · baru <strong>{calculation ? formatCredit(calculation.newConversion) : "—"}</strong> · jumlah <strong>{calculation ? formatCredit(calculation.conversionTotal) : "—"}</strong></p>
      {(Object.keys(pakComponentLabels) as PakComponent[]).map((key) => <div key={key} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1.5fr]"><p className="self-center text-sm font-medium">{pakComponentLabels[key]}</p>{(["old", "new", "note"] as const).map((part) => <Field key={part} id={`components.${key}.${part}`} label={part === "old" ? "Lama" : part === "new" ? "Baru" : "Keterangan (opsional)"} error={errors[`components.${key}.${part}`]}><Input id={`components.${key}.${part}`} type={part === "note" ? "text" : "number"} step={part === "note" ? undefined : "0.001"} min={part === "note" ? undefined : 0} value={part === "note" ? values.components[key][part] : numericValue(values.components[key][part])} onChange={(e) => setValue("components", { ...values.components, [key]: { ...values.components[key], [part]: part === "note" ? e.target.value : parseNumber(e.target.value) } })} /></Field>)}</div>)}
      <div className="grid gap-5 pt-2 md:grid-cols-2"><Field id="rankMinimum" label="Kebutuhan AK kenaikan pangkat" error={errors.rankMinimum}><Input id="rankMinimum" type="number" step="0.001" min={0} value={numericValue(values.rankMinimum)} onChange={(e) => setValue("rankMinimum", parseNumber(e.target.value))} /></Field><Field id="levelMinimum" label="Kebutuhan AK kenaikan jenjang (kosong bila tidak berlaku)" error={errors.levelMinimum}><Input id="levelMinimum" type="number" step="0.001" min={0} value={values.levelMinimum === null ? "" : numericValue(values.levelMinimum)} onChange={(e) => setValue("levelMinimum", e.target.value === "" ? null : Number(e.target.value))} /></Field></div>
      <p className="text-xs leading-5 text-zinc-500">Kebutuhan awal disarankan dari jenjang JF. Sesuaikan dengan target pangkat/jenjang dan PAK terakhir. Selisih AK bukan keputusan kelayakan kenaikan pangkat atau jenjang.</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Penetapan dan pejabat penilai</CardTitle><CardDescription>Penilai harus sesuai pejabat berwenang pada saat penetapan. Pilih dari data pegawai atau isi identitas secara manual.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-5 md:grid-cols-3">{field("nomor", "Nomor PAK")}{field("tanggal", "Tanggal penetapan", "date")}{field("tempatPenetapan", "Ditetapkan di")}</div>
      <Field id="pilih-penilai" label="Isi penilai dari data pegawai (opsional)"><select id="pilih-penilai" className={selectClass} value="" onChange={(e) => { const assessor = employees.find((item) => item.nip === e.target.value); if (assessor) { setValue("penilaiNama", assessor.name); setValue("penilaiNip", assessor.nip); } }}><option value="">Pilih untuk mengisi nama dan NIP</option>{employees.map((p) => <option key={p.nip} value={p.nip}>{p.name} · {p.status} · {p.position}</option>)}</select></Field>
      <div className="grid gap-5 md:grid-cols-2">{field("penilaiNama", "Nama pejabat penilai")}{field("penilaiNip", "NIP pejabat penilai")}</div>
    </CardContent></Card>
    <Card className="border-indigo-200 bg-indigo-50/30"><CardHeader><CardTitle>Ringkasan PAK</CardTitle><CardDescription>Dokumen Word memuat konversi, akumulasi, dan penetapan, mengikuti contoh dengan kop DKPP Kabupaten Indramayu.</CardDescription></CardHeader><CardContent className="space-y-5">
      {calculation ? <><div className="grid gap-4 sm:grid-cols-3">{[["AK lama", calculation.oldTotal], ["AK baru", calculation.newTotal], ["AK kumulatif", calculation.total]].map(([label, amount]) => <div key={label} className="rounded-lg border bg-white p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-2xl font-semibold">{formatCredit(Number(amount))}</p></div>)}</div><div className="text-sm leading-7"><p>Kenaikan pangkat: {Number.isFinite(calculation.rankDifference) ? `${calculation.rankDifference >= 0 ? "kelebihan" : "kekurangan"} ${formatCredit(Math.abs(calculation.rankDifference))} AK` : "isi kebutuhan AK"}.</p><p>Kenaikan jenjang: {calculation.levelDifference === null ? "tidak berlaku" : `${calculation.levelDifference >= 0 ? "kelebihan" : "kekurangan"} ${formatCredit(Math.abs(calculation.levelDifference))} AK`}.</p></div></> : <p className="text-sm text-zinc-600">Lengkapi jenjang, predikat, dan riwayat untuk melihat perhitungan.</p>}
      {failure && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{failure}</p>}
      <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>{submitting ? <LoaderCircle className="animate-spin" /> : <Download />}{submitting ? "Menyusun PAK..." : "Buat dan unduh PAK"}</Button>
      <p className="text-xs leading-5 text-zinc-500">Dokumen dan data isian disimpan ke arsip. <a className="underline" href="https://www.bkn.go.id/storage/2023/07/Peraturan-BKN-Nomor-3-Tahun-2023-tentang-AK-Kenaikan-Pagkat-Jenjang-JF.pdf" target="_blank" rel="noreferrer">Rujukan perhitungan: Peraturan BKN Nomor 3 Tahun 2023.</a></p>
    </CardContent></Card>
  </fieldset></form>;
}
