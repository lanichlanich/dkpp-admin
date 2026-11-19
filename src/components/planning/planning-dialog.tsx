"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { calculate, EVIDENCE_LIMIT, XLSX_LIMIT } from "@/lib/planning/model";
import type { PlanningView } from "@/lib/planning/store";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const fieldStyle = "min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus-visible:outline-2 focus-visible:outline-emerald-700 aria-invalid:border-red-600";
export const buttonStyle = "min-h-11 whitespace-normal px-3 text-base";
export const money = (value: number | null | undefined) => value == null ? "—" : "Rp" + new Intl.NumberFormat("id-ID").format(value);
export const number = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(value);
export type ViewNode = PlanningView["nodes"][number];
export type ViewIndicator = ViewNode["indicators"][number];
export type ViewEvidence = PlanningView["evidence"][number];
export type DialogState = {
  action: "budget" | "financial" | "assignment" | "target" | "evaluation" | "review" | "period" | "upload" | "import" | "archive";
  node?: ViewNode; indicator?: ViewIndicator; evidence?: ViewEvidence;
};
type Preview = { version: number; rows: { nodeId: string; code: string; row: number; title: string; old: number | null; amount: number; expectedRevision: number }[]; errors: string[] };
type UploadResponse = { id: string; uploadUrl: string };

export class RequestError extends Error {
  constructor(message: string, public fields: Record<string, string> = {}) { super(message); }
}
export async function send<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new RequestError(data.message ?? "Permintaan gagal. Coba lagi.", data.fields);
  return data as T;
}

const titles: Record<DialogState["action"], string> = {
  budget: "Atur pagu", financial: "Isi realisasi anggaran", assignment: "Atur penugasan tahunan",
  target: "Edit target", evaluation: "Isi capaian", review: "Periksa capaian", period: "Atur periode",
  upload: "Unggah bukti final", import: "Impor pagu Excel", archive: "Kelola arsip bukti",
};
const INHERIT = "__inherit__";
const UNASSIGNED = "__unassigned__";
const UNAVAILABLE = "__unavailable__";

export function PlanningDialog({ state, view, url, close, saved }: {
  state: DialogState; view: PlanningView; url: string; close: () => void; saved: (message: string) => Promise<void>;
}) {
  const { action, node, indicator, evidence } = state;
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview>();
  const [useCalculator, setUseCalculator] = useState(!!indicator?.evaluation?.data.calculation);
  const [a, setA] = useState(String(indicator?.evaluation?.data.calculation?.a ?? ""));
  const [b, setB] = useState(String(indicator?.evaluation?.data.calculation?.b ?? ""));
  const assignment = indicator ? indicator.assignment : node?.assignment;
  const assignedId = assignment?.data.ownerUserId;
  const [owner, setOwner] = useState(() => {
    if (assignedId === "" || assignment?.data.ownerName === "") return UNASSIGNED;
    if (assignedId || assignment?.data.ownerName)
      return view.accounts.some(account => account.id === assignedId) ? assignedId! : UNAVAILABLE;
    return INHERIT;
  });
  const [accountQuery, setAccountQuery] = useState("");
  const current = indicator?.evaluation?.data;
  const method = indicator?.method;
  const computed = method?.kind && a.trim() && b.trim() ? calculate(method.kind, Number(a), Number(b)) : null;
  const version = view.version;

  const input = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block space-y-1"><span className="font-medium">{label}</span>
      <input className={fieldStyle} name={name} aria-invalid={!!fields[name]} {...props} />
      {fields[name] && <span className="block text-red-700">{fields[name]}</span>}
    </label>
  );
  const area = (name: string, label: string, defaultValue = "", required = false) => (
    <label className="block space-y-1"><span className="font-medium">{label}</span>
      <textarea className={fieldStyle} name={name} rows={3} defaultValue={defaultValue} maxLength={2400} required={required} aria-invalid={!!fields[name]} />
      {fields[name] && <span className="block text-red-700">{fields[name]}</span>}
    </label>
  );
  const select = (name: string, label: string, options: ReactNode, props: React.SelectHTMLAttributes<HTMLSelectElement> = {}) => (
    <label className="block space-y-1"><span className="font-medium">{label}</span>
      <select className={fieldStyle} name={name} aria-invalid={!!fields[name]} {...props}>{options}</select>
      {fields[name] && <span className="block text-red-700">{fields[name]}</span>}
    </label>
  );
  async function staged(file: File, body: object, mime: string) {
    const meta = await send<UploadResponse>(url + "&upload=prepare", { ...body, mime, size: file.size, filename: file.name, version });
    const result = await fetch(meta.uploadUrl, { method: "PUT", headers: { "Content-Type": mime, "x-upsert": "false" }, body: file });
    if (!result.ok) throw new RequestError("Unggahan gagal. Pilih kembali berkas dan coba lagi.");
    return send<{ preview: Preview | null }>(url + "&upload=finish", { id: meta.id });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const value = (name: string) => text(name) === "" ? null : Number(text(name));
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status = submitter?.value || "draft";
    const id = { nodeId: node?.id, indicatorId: indicator?.id };
    setProblem("");
    setFields({});
    setPending(true);
    try {
      if (action === "upload" || (action === "import" && !preview)) {
        const file = form.get("file");
        const max = action === "upload" ? EVIDENCE_LIMIT : XLSX_LIMIT;
        if (!(file instanceof File) || file.size < 1 || file.size > max)
          throw new RequestError(`Pilih berkas berukuran sampai ${max / 1024 ** 2} MB.`);
        if (action === "import") {
          const result = await staged(file, { usage: "xlsx" }, XLSX_MIME);
          setPreview(result.preview ?? undefined);
          return;
        }
        const extension = file.name.split(".").at(-1)?.toLowerCase();
        const mime = extension === "pdf" ? "application/pdf" : extension === "png" ? "image/png"
          : extension === "jpg" || extension === "jpeg" ? "image/jpeg" : "";
        if (!mime) throw new RequestError("Pilih PDF, JPG, atau PNG.");
        const sourceEvidence = evidence ? {
          id: evidence.subject, revision: evidence.revision, checkedAssociation: form.get("association") === "on",
        } : undefined;
        await staged(file, { usage: "evidence", ...id, title: evidence?.data.title ?? text("title"), sourceEvidence }, mime);
        await saved("Bukti final tersimpan.");
        return;
      }
      const correction = text("correction");
      let payload: object;
      switch (action) {
        case "budget": payload = { ...id, amount: value("amount"), note: text("note"), expectedRevision: node?.budgetRecord?.revision ?? 0 }; break;
        case "financial": payload = { ...id, amount: value("amount"), note: text("note"), correction, expectedRevision: node?.financial?.revision ?? 0 }; break;
        case "target": payload = { ...id, value: value("value"), source: text("source"), expectedRevision: indicator?.target?.revision ?? 0 }; break;
        case "evaluation": payload = { ...id, status, issue: text("issue"), followup: text("followup"), deadline: text("deadline"), correction, real: value("real"),
          calculation: useCalculator && method?.kind ? { table: method.table, a: Number(a), b: Number(b) } : null,
          expectedRevision: indicator?.evaluation?.revision ?? 0 }; break;
        case "review": payload = { ...id, status, reviewNote: text("reviewNote"), correction, expectedRevision: indicator?.evaluation?.revision ?? 0 }; break;
        case "period": payload = { closed: !view.period.closed, reason: text("reason"), expectedRevision: view.periodRevision }; break;
        case "assignment":
          payload = { ...id, ownerUserId: owner === INHERIT ? null : owner === UNASSIGNED ? "" : owner, expectedRevision: assignment?.revision ?? 0 };
          break;
        case "archive": payload = { evidenceId: evidence?.subject, archived: !evidence?.data.archived, expectedRevision: evidence?.revision ?? 0 }; break;
        case "import": payload = { version: preview!.version, rows: preview!.rows, note: text("note") }; break;
      }
      await send(url, { action, version, ...payload });
      await saved(action === "import" ? `${preview!.rows.length} pagu berhasil disimpan.` : "Perubahan tersimpan.");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Penyimpanan belum berhasil.");
      if (error instanceof RequestError) setFields(error.fields);
    } finally { setPending(false); }
  }

  const reason = view.period.reopened && ["financial", "evaluation", "review"].includes(action) && area("correction", "Alasan koreksi", "", true);
  let submitLabel: string | null = "Simpan";
  let content: ReactNode;
  switch (action) {
    case "budget":
      content = <>{input("amount", "Pagu tahunan dalam Rupiah", { type: "number", min: 0, step: 1, defaultValue: node?.budget?.amount ?? "" })}
        <p className="text-zinc-600">Kosongkan untuk menandai pagu belum tersedia.</p>{area("note", "Rujukan perubahan anggaran", node?.budget?.note, true)}</>;
      break;
    case "financial":
      content = <>{input("amount", "Realisasi kumulatif sampai akhir triwulan", { type: "number", min: 0, step: 1, defaultValue: node?.financial?.data.amount ?? "" })}
        {area("note", "Catatan realisasi", node?.financial?.data.note)}{reason}</>;
      break;
    case "target":
      content = <>{input("value", `Target tahunan (${indicator?.unit})`, { type: "number", step: "any", defaultValue: indicator?.effectiveTarget ?? "" })}
        {area("source", "Sumber target", indicator?.target?.data.source, true)}</>;
      break;
    case "evaluation":
      content = <>
        {method?.kind && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={useCalculator} onChange={event => setUseCalculator(event.target.checked)} />
          Gunakan kalkulator Tabel {method.table}</label>}
        {useCalculator && method?.kind ? <>
          {input("a", method.labels?.[0] ?? "Pembilang", { type: "number", min: 0, step: "any", value: a, onChange: event => setA(event.target.value), required: true })}
          {input("b", method.labels?.[1] ?? "Pembagi", { type: "number", min: Number.MIN_VALUE, step: method.kind === "average" ? 1 : "any", value: b, onChange: event => setB(event.target.value), required: true })}
          <p>Hasil perhitungan {number(computed)} {indicator?.unit}</p>
        </> : input("real", `Realisasi (${indicator?.unit})`, { type: "number", step: "any", defaultValue: current?.real ?? "" })}
        {current?.reviewNote && <p className="rounded-lg bg-amber-50 p-3">Catatan pemeriksa · {current.reviewNote}</p>}
        {area("issue", "Kendala", current?.issue)}{area("followup", "Tindak lanjut", current?.followup)}
        {input("deadline", "Tenggat", { type: "date", defaultValue: current?.deadline ?? "" })}{reason}
      </>;
      submitLabel = null;
      break;
    case "review":
      content = <><p>Realisasi diajukan · <strong>{number(current?.real)} {indicator?.unit}</strong></p>
        {area("reviewNote", "Catatan pemeriksa")}{reason}</>;
      submitLabel = null;
      break;
    case "period":
      content = area("reason", view.period.closed ? "Alasan membuka kembali" : "Alasan menutup periode", "", true);
      submitLabel = view.period.closed ? "Buka kembali periode" : "Tutup periode";
      break;
    case "assignment": {
      const search = accountQuery.trim().toLocaleLowerCase("id");
      const available = view.accounts.filter(account => account.id === owner ||
        (account.name + " " + account.username).toLocaleLowerCase("id").includes(search));
      const currentOwner = indicator?.owner.ownerName ?? node?.owner?.ownerName;
      content = <>
        <p className="text-zinc-700">Tahun {view.year}. Pilih akun aktif yang memiliki izin menu ini di Manajemen User.</p>
        {!indicator && node?.type !== "subkegiatan" && <p className="text-zinc-700">Penugasan berlaku juga pada rincian yang mengikuti induk.</p>}
        {owner === UNAVAILABLE && <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
          {currentOwner ? `${currentOwner} tercatat sebagai penanggung jawab.` : "Akun penanggung jawab tidak tersedia."} Pilih akun DKPP untuk memberikan akses.
        </p>}
        {input("accountQuery", "Cari akun DKPP", {
          type: "search", value: accountQuery, placeholder: "Nama atau username", onChange: event => setAccountQuery(event.target.value),
        })}
        {select("owner", "Penanggung jawab", <>
          <option value={INHERIT}>Ikuti induk</option>
          <option value={UNASSIGNED}>Belum ditetapkan</option>
          {owner === UNAVAILABLE && <option value={UNAVAILABLE} disabled>Akun belum tertaut atau tidak aktif</option>}
          {available.map(account => <option key={account.id} value={account.id}>{account.name} (@{account.username})</option>)}
        </>, { value: owner, onChange: event => setOwner(event.target.value) })}
        {search && !available.some(account => (account.name + " " + account.username).toLocaleLowerCase("id").includes(search)) &&
          <p className="text-zinc-600">Akun yang cocok tidak ditemukan.</p>}
      </>;
      break;
    }
    case "upload":
      content = <>{evidence ? <>
        <p>Unggah PDF asli SIPENA. Ukuran dan SHA-256 diperiksa sebelum pengaitan.</p>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="association" required />
          Saya telah memeriksa isi PDF dan memastikan kaitannya dengan subkegiatan ini.</label>
      </> : input("title", "Judul bukti", { required: true, maxLength: 240 })}
        {input("file", "Berkas PDF, JPG, atau PNG · maks. 10 MB", { type: "file", accept: ".pdf,.jpg,.jpeg,.png", required: true })}</>;
      submitLabel = "Unggah bukti";
      break;
    case "archive":
      content = <p>{evidence?.data.archived ? "Pulihkan" : "Arsipkan"} bukti <strong>{evidence?.data.title}</strong>?</p>;
      submitLabel = evidence?.data.archived ? "Pulihkan" : "Arsipkan";
      break;
    case "import":
      content = !preview ? <>
        <a className="inline-flex min-h-11 items-center font-medium text-emerald-800 underline" href={url + "&file=template"}>Unduh template tahun {view.year}</a>
        {input("file", "Lembar Pagu dalam .xlsx · maks. 5 MB", { type: "file", accept: ".xlsx", required: true })}
      </> : <>
        {preview.errors.length > 0 && <ul className="list-disc space-y-1 rounded-lg bg-red-50 py-3 pl-7 pr-3 text-red-800">{preview.errors.map((error, i) => <li key={i}>{error}</li>)}</ul>}
        {preview.rows.length === 0 && <p>Belum ada nilai pagu baru pada lembar Pagu.</p>}
        {preview.rows.length > 0 && <ul className="max-h-60 space-y-2 overflow-auto rounded-lg border p-3">
          {preview.rows.map(row => <li key={row.row} className="border-b pb-2 last:border-0"><strong>Baris {row.row} · {row.code}</strong>
            <p>{row.title}</p><p>{money(row.old)} → {money(row.amount)}</p></li>)}
        </ul>}
        {area("note", "Rujukan perubahan anggaran", "", true)}
        <Button type="button" variant="outline" className={buttonStyle} onClick={() => setPreview(undefined)}>Pilih berkas lain</Button>
      </>;
      submitLabel = preview ? "Simpan semua pagu" : "Periksa berkas";
      break;
  }

  return <Dialog open onOpenChange={open => { if (!open && !pending) close(); }}>
    <DialogContent showCloseButton={false} className="max-h-[90dvh] gap-3 overflow-y-auto bg-white p-5 text-base sm:max-w-2xl">
      <DialogTitle className="text-xl font-semibold">{titles[action]}</DialogTitle>
      <DialogDescription className="text-base text-zinc-600">{indicator?.name ?? node?.title ?? `Tahun ${view.year} · Triwulan ${view.quarter}`}</DialogDescription>
      <form onSubmit={submit}>
        <fieldset disabled={pending} className="space-y-3">
          {content}
          {problem && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{problem}</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button className={buttonStyle} type="button" variant="outline" onClick={close}>Batal</Button>
            {action === "evaluation" && <><Button className={buttonStyle} type="submit" variant="outline" value="draft">Simpan draf</Button>
              <Button className={buttonStyle} type="submit" value="submitted">Ajukan capaian</Button></>}
            {action === "review" && <><Button className={buttonStyle} type="submit" variant="destructive" value="returned">Kembalikan</Button>
              <Button className={buttonStyle} type="submit" value="checked">Tandai selesai</Button></>}
            {submitLabel && <Button className={buttonStyle} type="submit" disabled={(action === "assignment" && owner === UNAVAILABLE) || (action === "import" && !!preview && (!preview.rows.length || !!preview.errors.length))}>{submitLabel}</Button>}
          </div>
        </fieldset>
        {pending && <p role="status" className="mt-3 text-zinc-600">Sedang memproses…</p>}
      </form>
    </DialogContent>
  </Dialog>;
}
