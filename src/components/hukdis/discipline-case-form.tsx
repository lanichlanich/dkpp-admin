"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  disciplineCaseStatus, disciplineDocuments, disciplineLevels, disciplineSanctions, emptyDisciplineCase,
  type DisciplineCase, type DisciplineCaseInput, type DisciplineDocument, type DisciplineEmployee, type DisciplinePerson,
} from "@/lib/discipline-case";

const sections = ["Perkara", "Pemanggilan", "Tim pemeriksa", "Pemeriksaan", "Keputusan", "Draf surat"] as const;
const selectStyle = "min-h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm";
type FieldType = "text" | "date" | "time" | "multiline";
type Option = readonly [value: string, label: string];
type Field = readonly [name: string, label: string, kind?: FieldType | readonly Option[]];

function Fields({ fields, values, change }: { fields: readonly Field[]; values: object; change: (field: string, value: string) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2">{fields.map(([name, label, kind]) => {
    const value = String((values as Record<string, unknown>)[name] ?? "");
    return <label key={name} className={`grid gap-1.5 self-start text-sm font-medium ${kind === "multiline" ? "sm:col-span-2" : ""}`}>
      <span>{label}</span>
      {kind === "multiline"
        ? <Textarea value={value} onChange={e => change(name, e.target.value)} rows={3} />
        : typeof kind === "object"
          ? <select value={value} className={selectStyle} onChange={e => change(name, e.target.value)}>
              <option value="">Pilih atau kosongkan</option>{kind.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
            </select>
          : <Input type={kind ?? "text"} value={value} onChange={e => change(name, e.target.value)} />}
    </label>;
  })}</div>;
}

function PersonFields({ title, person, employees, change }: {
  title: string; person: DisciplinePerson; employees: DisciplineEmployee[]; change: (value: DisciplinePerson) => void;
}) {
  return <fieldset className="space-y-3 rounded-lg border p-4">
    <legend className="px-1 font-medium">{title}</legend>
    <label className="grid gap-1.5 text-sm">
      <span>Isi dari data pegawai</span>
      <select className={selectStyle} value={employees.some(p => p.nip === person.nip) ? person.nip : ""}
        onChange={e => { const p = employees.find(item => item.nip === e.target.value); if (p) change({ name: p.name, nip: p.nip, rank: p.rank, position: p.position }); }}>
        <option value="">Pilih pegawai atau isi manual</option>
        {employees.map(p => <option key={p.nip} value={p.nip}>{p.name} · {p.nip}</option>)}
      </select>
    </label>
    <Fields fields={[["name", "Nama"], ["nip", "NIP"], ["rank", "Pangkat / golongan"], ["position", "Jabatan"]]} values={person}
      change={(field, value) => change({ ...person, [field]: value })} />
  </fieldset>;
}

const appointmentFields: Field[] = [["date", "Tanggal agenda", "date"], ["time", "Jam (WIB)", "time"], ["place", "Tempat"]];
const callFields: Field[] = [["number", "Nomor panggilan"], ["letterDate", "Tanggal surat", "date"], ...appointmentFields,
  ["attendance", "Kehadiran", [["hadir", "Hadir"], ["tidak-hadir", "Tidak hadir"]]]];
const endpoint = "/api/penjatuhan-hukdis";

export function DisciplineCaseForm({ initial, employees }: { initial?: DisciplineCase; employees: DisciplineEmployee[] }) {
  const router = useRouter();
  const [record, setRecord] = useState(initial);
  const [values, setValues] = useState(initial?.values ?? emptyDisciplineCase);
  const [section, setSection] = useState<(typeof sections)[number]>("Perkara");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | DisciplineDocument | null>(null);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const employee = record?.employee ?? employees.find(p => p.nip === values.employeeNip);
  const change = (next: Partial<DisciplineCaseInput>) => { setValues(v => ({ ...v, ...next })); setDirty(true); setSaved(false); };
  const nested = <K extends "firstCall" | "secondCall" | "team" | "review" | "decision">(key: K, field: string, value: string | DisciplinePerson | boolean) =>
    change({ [key]: { ...values[key], [field]: value } } as Pick<DisciplineCaseInput, K>);
  const editPerson = (title: string, key: "examiner" | "authority") =>
    <PersonFields title={title} person={values[key]} employees={employees} change={person => change({ [key]: person })} />;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy("save"); setMessage(""); setSaved(false);
    try {
      const response = await fetch(record ? `${endpoint}/${record.id}` : endpoint, {
        method: record ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, version: record?.version }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setRecord(result.record);
      setValues(result.record.values);
      setDirty(false);
      setSaved(true);
      if (record) router.refresh();
      else router.replace(`/dashboard/penjatuhan-hukdis?perkara=${result.record.id}`, { scroll: false });
    } catch (error) { setMessage((error as Error).message || "Perkara gagal disimpan."); }
    finally { setBusy(null); }
  }

  async function download(kind: DisciplineDocument) {
    if (!record || busy || dirty) return;
    setBusy(kind); setMessage("");
    try {
      const response = await fetch(`${endpoint}/${record.id}/dokumen/${kind}`, { cache: "no-store" });
      if (!response.ok) throw new Error((await response.json()).message);
      const encoded = response.headers.get("Content-Disposition")?.split("filename*=UTF-8''")[1];
      const file = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = file;
      a.download = encoded ? decodeURIComponent(encoded) : `Draf-${kind}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(file), 1000);
    } catch (error) { setMessage((error as Error).message || "Dokumen gagal diunduh."); }
    finally { setBusy(null); }
  }

  return <form onSubmit={save} className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="text-lg font-semibold">{record ? values.reference : "Tambah perkara disiplin"}</h2>
        {employee && <p className="mt-1 text-sm text-muted-foreground">{employee.name} · {employee.position || employee.unit}</p>}</div>
      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-900">{disciplineCaseStatus(values)}</span>
    </header>
    <nav aria-label="Tahap administrasi" className="flex flex-wrap gap-1 border-b pb-3">
      {sections.map(item => <Button key={item} type="button" size="sm" variant={section === item ? "default" : "ghost"}
        aria-pressed={section === item} onClick={() => setSection(item)}>{item}</Button>)}
    </nav>
    <fieldset disabled={busy !== null} className="min-w-0 space-y-4">
      {section === "Perkara" && <>
        <label className="grid gap-1.5 text-sm font-medium"><span>PNS yang diperiksa</span>
          <select className={selectStyle} value={values.employeeNip} disabled={Boolean(record)} onChange={e => change({ employeeNip: e.target.value })}>
            <option value="">Pilih PNS aktif</option>
            {record && !employees.some(p => p.nip === record.employee.nip) && <option value={record.employee.nip}>{record.employee.name}</option>}
            {employees.map(p => <option value={p.nip} key={p.nip}>{p.name} · {p.nip}</option>)}
          </select>
        </label>
        <Fields fields={[["reference", "Nomor register"], ["level", "Tingkat hukuman yang ditelaah", disciplineLevels.map(level => [level, level] as const)],
          ["incidentDate", "Tanggal kejadian", "date"], ["incidentPlace", "Tempat kejadian"], ["provision", "Pasal / ayat / huruf PP 94 Tahun 2021"],
          ["allegation", "Uraian dugaan", "multiline"]]} values={values} change={(field, value) => change({ [field]: value })} />
        {editPerson("Atasan langsung atau ketua tim pemeriksa", "examiner")}
      </>}
      {section === "Pemanggilan" && <>
        <p className="text-sm text-muted-foreground">Periksa jarak hari kerja antara surat dan pemeriksaan serta tenggat Panggilan II. Catat ketidakhadiran hanya setelah jadwalnya lewat.</p>
        {(["firstCall", "secondCall"] as const).map((key, index) => <section key={key} className="space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">Panggilan {index === 0 ? "I" : "II"}</h3>
          <Fields fields={callFields} values={values[key]} change={(field, value) => nested(key, field, value)} />
        </section>)}
      </>}
      {section === "Tim pemeriksa" && <>
        <p className="text-sm text-muted-foreground">Tim dapat dibentuk untuk dugaan hukuman sedang dan wajib untuk dugaan hukuman berat. Isi pejabat pembentuk berdasarkan penetapan atau penunjukan yang berlaku.</p>
        <Fields fields={[["number", "Nomor surat pembentukan"], ["date", "Tanggal pembentukan", "date"]]} values={values.team} change={(field, value) => nested("team", field, value)} />
        {editPerson("Atasan langsung atau ketua tim pemeriksa", "examiner")}
        {([["oversight", "Unsur pengawasan"], ["hr", "Unsur kepegawaian"], ["other", "Pejabat lain yang ditunjuk (opsional)"], ["issuer", "PPK atau pejabat yang ditunjuk"]] as const)
          .map(([key, title]) => <PersonFields key={key} title={title} person={values.team[key]} employees={employees} change={p => nested("team", key, p)} />)}
      </>}
      {section === "Pemeriksaan" && <>
        <Fields fields={[["date", "Tanggal pemeriksaan", "date"], ["place", "Tempat atau media pemeriksaan"],
          ["signature", "Pencatatan berita acara", [["ditandatangani", "Ditandatangani"], ["menolak", "PNS menolak menandatangani"], ["dua-kali-tidak-hadir", "Tidak hadir pada dua panggilan"]]],
          ["outcome", "Kesimpulan", [["terbukti", "Terbukti"], ["tidak-terbukti", "Tidak terbukti"]]],
          ["questions", "Pertanyaan dan jawaban (beri nomor setiap butir)", "multiline"], ["evidence", "Alat bukti dan keterangan", "multiline"],
          ["findings", "Uraian hasil pemeriksaan atau penelaahan bukti", "multiline"],
          ["reportDate", "Tanggal laporan hasil pemeriksaan", "date"], ["recipient", "Pejabat tujuan laporan"], ["recipientPlace", "Tempat tujuan laporan"],
          ["recommendation", "Rekomendasi pemeriksa"], ["aggravating", "Faktor memberatkan", "multiline"],
          ["mitigating", "Faktor meringankan", "multiline"], ["impact", "Dampak perbuatan", "multiline"]]}
          values={values.review} change={(field, value) => nested("review", field, value)} />
      </>}
      {section === "Keputusan" && <>
        <p className="text-sm text-muted-foreground">Pilih jenis hukuman dan pejabat berdasarkan kewenangan yang berlaku. Untuk hukuman sedang, periksa ketentuan peralihan Pasal 42 sebelum memilih jenisnya.</p>
        <Fields fields={[["number", "Nomor keputusan"], ["date", "Tanggal keputusan", "date"], ["place", "Tempat penetapan"],
          ["sanction", "Jenis hukuman", disciplineSanctions.filter(item => !values.level || item.level === values.level).map(item => [item.id, item.label] as const)],
          ["consideration", "Pertimbangan tambahan", "multiline"], ["extraBasis", "Dasar hukum tambahan"]]}
          values={values.decision} change={(field, value) => nested("decision", field, value)} />
        {editPerson("Pejabat yang berwenang menghukum", "authority")}
        <label className="flex items-start gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={values.decision.issued}
          disabled={Boolean(record?.values.decision.issued)} onChange={e => nested("decision", "issued", e.target.checked)} />
          <span>Keputusan sudah ditetapkan oleh pejabat berwenang</span></label>
        <section className="space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">Panggilan untuk menerima keputusan</h3>
          <Fields fields={[["letterDate", "Tanggal surat panggilan", "date"], ...appointmentFields, ["recipientPlace", "Tempat tujuan surat"]]}
            values={values.decision.delivery} change={(field, value) => change({ decision: { ...values.decision, delivery: { ...values.decision.delivery, [field]: value } } })} />
        </section>
        <Fields fields={[["sent", "Tanggal disampaikan atau dikirim", "date"], ["received", "Tanggal diterima", "date"],
          ["effective", "Tanggal berlaku (setelah diverifikasi)", "date"],
          ["appeal", "Upaya administratif", [["tidak-diajukan", "Tidak diajukan"], ["keberatan", "Keberatan dalam proses"], ["banding", "Banding dalam proses"], ["diputus", "Sudah diputus"]]],
          ["appealDate", "Tanggal pengajuan upaya administratif", "date"], ["appealResult", "Hasil upaya administratif", "multiline"]]}
          values={values.decision} change={(field, value) => nested("decision", field, value)} />
      </>}
      {section === "Draf surat" && <>
        <p className="text-sm text-muted-foreground">Unduh Word dari data perkara yang sudah disimpan. Format keputusan tersedia untuk tiga jenis hukuman ringan. Untuk hukuman sedang dan berat, catat keputusan yang ditetapkan oleh pejabat berwenang.</p>
        {(!record || dirty) && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Simpan perkara sebelum mengunduh.</p>}
        <div className="grid gap-2 lg:grid-cols-2">
          {disciplineDocuments.map(item => <Button key={item.id} type="button" variant="outline"
            className="h-auto min-h-10 justify-start whitespace-normal text-left" disabled={!record || dirty}
            onClick={() => download(item.id)}>{busy === item.id ? <LoaderCircle className="animate-spin" /> : <Download />}{item.label}</Button>)}
        </div>
      </>}
    </fieldset>
    {message && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{message}</p>}
    {saved && <p role="status" className="text-sm text-emerald-700">Perkara tersimpan.</p>}
    <div className="flex justify-end border-t pt-4"><Button type="submit" disabled={busy !== null || (Boolean(record) && !dirty)}>
      {busy === "save" ? <LoaderCircle className="animate-spin" /> : <Save />} Simpan perkara
    </Button></div>
  </form>;
}
