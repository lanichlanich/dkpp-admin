"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Download, Printer, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/table";
import type { LibraryVisitor, LibraryVisit, LibraryEmployee, VisitorInput } from "@/lib/library-types";
import { LIBRARY_CARDS_PER_PAGE, LIBRARY_CARD_BATCH_LIMIT } from "@/lib/library-types";
import { LibraryField, libraryRequest, selectClass, dateLabel } from "./admin-shared";

export function VisitorsAdmin({ visitors, visits, employees, today }: { visitors: LibraryVisitor[]; visits: LibraryVisit[]; employees: LibraryEmployee[]; today: string }) {
  const [search,setSearch] = useState(""), [edit,setEdit] = useState<LibraryVisitor | "new" | null>(null), [visit,setVisit] = useState<string | null>(null), [page,setPage] = useState(1), [visitPage,setVisitPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(() => new Set()), [printing, setPrinting] = useState(false);
  const router=useRouter(), done=()=>{setEdit(null);setVisit(null);router.refresh();};
  const filtered=visitors.filter(v=>`${v.name} ${v.cardNumber} ${v.employeeNip || ""} ${v.organization}`.toLowerCase().includes(search.toLowerCase()));
  const pages=Math.max(1,Math.ceil(filtered.length/20)), current=Math.min(page,pages);
  const visibleRows = filtered.slice((current - 1) * 20, current * 20);
  const selectedVisitors = visitors.filter(visitor => selected.has(visitor.id));
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every(visitor => selected.has(visitor.id));
  const someVisibleSelected = visibleRows.some(visitor => selected.has(visitor.id));
  function selectRows(rows: LibraryVisitor[], checked: boolean) {
    setSelected(previous => { const next = new Set(previous); for (const row of rows) { if (checked) next.add(row.id); else next.delete(row.id); } return next; });
  }
  async function printCards() {
    if (printing || !selectedVisitors.length) return;
    if (selectedVisitors.length > LIBRARY_CARD_BATCH_LIMIT) { toast.error("Maksimal 1.000 kartu per unduhan. Kurangi pilihan terlebih dahulu."); return; }
    setPrinting(true);
    try {
      const response = await fetch("/api/library/visitors/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitorIds: selectedVisitors.map(visitor => visitor.id) }) });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "Kartu gagal dibuat. Silakan coba lagi.");
      }
      const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
      link.href = url; link.download = "Kartu-Pengunjung-Terpilih.pdf"; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`PDF ${selectedVisitors.length} kartu (${Math.ceil(selectedVisitors.length / LIBRARY_CARDS_PER_PAGE)} halaman) siap dicetak.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Kartu gagal dibuat."); }
    finally { setPrinting(false); }
  }
  const history=visits.filter(v=>`${v.name} ${v.cardNumber} ${v.visitDate} ${v.purpose}`.toLowerCase().includes(search.toLowerCase()));
  const historyPages=Math.max(1,Math.ceil(history.length/20)), historyPage=Math.min(visitPage,historyPages);
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><Input aria-label="Cari pengunjung" className="max-w-md" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);setVisitPage(1);}} placeholder="Cari nama, nomor kartu, NIP, atau instansi…" /><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={printing || !selectedVisitors.length} onClick={printCards}>{printing ? <LoaderCircle className="size-4 animate-spin" /> : <Printer className="size-4" />}{printing ? "Membuat PDF…" : `Cetak kartu terpilih (${selectedVisitors.length})`}</Button><Button variant="outline" disabled={!visitors.some(v=>v.isActive)} onClick={()=>setVisit("")}>Catat kunjungan</Button><Button onClick={()=>setEdit("new")}><Plus className="size-4" />Tambah pengunjung</Button></div></div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-emerald-50/50 p-3">
      <p aria-live="polite" className="text-sm text-zinc-600">{selectedVisitors.length} kartu terpilih di semua halaman · {LIBRARY_CARDS_PER_PAGE} kartu per halaman A4.</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={printing || !filtered.length || filtered.every(visitor => selected.has(visitor.id))} onClick={() => selectRows(filtered, true)}>Pilih semua hasil pencarian ({filtered.length})</Button><Button size="sm" variant="ghost" disabled={printing || !selectedVisitors.length} onClick={() => setSelected(new Set())}>Batal pilih</Button></div>
    </div>
    <div><h2 className="mb-3 font-semibold">Pengunjung terdaftar ({visitors.length})</h2><div className="rounded-xl border bg-white"><Table>
      <TableHeader><TableRow><TableHead className="w-10"><Checkbox aria-label="Pilih semua pengunjung di halaman ini" checked={allVisibleSelected} indeterminate={!allVisibleSelected && someVisibleSelected} disabled={printing || !visibleRows.length} onCheckedChange={checked => selectRows(visibleRows, Boolean(checked))} /></TableHead><TableHead>Pengunjung</TableHead><TableHead>Nomor kartu</TableHead><TableHead>Instansi / unit</TableHead><TableHead>Status</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
      <TableBody>{visibleRows.map(v=><TableRow key={v.id}><TableCell><Checkbox aria-label={`Pilih kartu ${v.name} (${v.cardNumber})`} checked={selected.has(v.id)} disabled={printing} onCheckedChange={checked => selectRows([v], Boolean(checked))} /></TableCell><TableCell><p className="font-medium">{v.name}</p><p className="text-xs text-zinc-500">{v.employeeNip || "Umum / manual"}</p></TableCell><TableCell className="font-mono text-xs">{v.cardNumber}</TableCell><TableCell className="max-w-xs whitespace-normal">{v.organization || "-"}</TableCell><TableCell>{v.isActive ? "Aktif" : "Nonaktif"}</TableCell><TableCell><div className="flex flex-wrap items-center gap-2"><Button variant="ghost" size="icon" aria-label={`Edit ${v.name}`} onClick={()=>setEdit(v)}><Pencil className="size-4" /></Button><a download href={`/api/library/visitors/${v.id}/card`} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700"><Download className="size-4" />Kartu PDF</a><Button variant="outline" size="sm" disabled={!v.isActive} onClick={()=>setVisit(v.id)}>Kunjungan</Button></div></TableCell></TableRow>)}{!filtered.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-zinc-500">Belum ada pengunjung yang sesuai.</TableCell></TableRow>}</TableBody></Table>
    </div><Pager current={current} pages={pages} change={setPage} /></div>
    <div><h2 className="mb-3 font-semibold">Riwayat kunjungan ({visits.length})</h2><div className="rounded-xl border bg-white"><Table><TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Pengunjung</TableHead><TableHead>Keperluan</TableHead></TableRow></TableHeader><TableBody>{history.slice((historyPage-1)*20,historyPage*20).map(v=><TableRow key={v.id}><TableCell>{dateLabel(v.visitDate)}</TableCell><TableCell>{v.name}<p className="text-xs text-zinc-500">{v.cardNumber}</p></TableCell><TableCell className="whitespace-normal">{v.purpose || "-"}</TableCell></TableRow>)}{!history.length && <TableRow><TableCell colSpan={3} className="py-8 text-center text-zinc-500">Belum ada kunjungan yang sesuai.</TableCell></TableRow>}</TableBody></Table></div><Pager current={historyPage} pages={historyPages} change={setVisitPage} /></div>
    <Dialog open={edit!==null} onOpenChange={open=>{if(!open)setEdit(null);}}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{edit==="new"?"Tambah pengunjung":"Edit pengunjung"}</DialogTitle><DialogDescription>Daftarkan pengunjung umum secara manual atau pilih pegawai aktif. Kartu dapat diunduh setelah data disimpan.</DialogDescription></DialogHeader>{edit && <VisitorEditor key={typeof edit==="string"?edit:edit.id} visitor={edit==="new"?undefined:edit} employees={employees} done={done} />}</DialogContent></Dialog>
    <Dialog open={visit!==null} onOpenChange={open=>{if(!open)setVisit(null);}}><DialogContent><DialogHeader><DialogTitle>Catat kunjungan</DialogTitle><DialogDescription>Pilih pengunjung yang sudah terdaftar dan tanggal kunjungannya.</DialogDescription></DialogHeader>{visit!==null && <VisitEditor key={visit} initialId={visit} visitors={visitors} today={today} done={done} />}</DialogContent></Dialog>
  </div>;
}
function Pager({current,pages,change}:{current:number;pages:number;change:(v:number)=>void}) { return <div className="mt-3 flex items-center justify-between"><Button variant="outline" size="sm" disabled={current<=1} onClick={()=>change(current-1)}>Sebelumnya</Button><span className="text-xs text-zinc-500">{current} / {pages}</span><Button variant="outline" size="sm" disabled={current>=pages} onClick={()=>change(current+1)}>Berikutnya</Button></div>; }
function VisitorEditor({visitor,employees,done}:{visitor?:LibraryVisitor;employees:LibraryEmployee[];done:()=>void}) {
  const [source,setSource]=useState(visitor?.employeeNip?"employee":"manual"), [values,setValues]=useState<VisitorInput>(visitor?{...visitor,employeeNip:visitor.employeeNip??"",isActive:Boolean(visitor.isActive)}:{employeeNip:"",name:"",organization:"",phone:"",address:"",isActive:true}), [busy,setBusy]=useState(false), [error,setError]=useState("");
  const change=(key:keyof VisitorInput,value:string|boolean)=>setValues(v=>({...v,[key]:value}));
  async function submit(e:React.FormEvent) { e.preventDefault();setBusy(true);setError("");try{await libraryRequest(visitor?`visitors/${visitor.id}`:"visitors",visitor?"PATCH":"POST",{...values,employeeNip:source==="manual"?"":values.employeeNip,updatedAt:visitor?.updatedAt});toast.success("Pengunjung disimpan.");done();}catch(e){setError((e as Error).message);}finally{setBusy(false);} }
  return <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4"><label className="grid gap-2 text-sm font-medium">Jenis pengunjung<select aria-label="Jenis pengunjung" className={selectClass} disabled={Boolean(visitor)} value={source} onChange={e=>{setSource(e.target.value);setValues(v=>({...v,employeeNip:"",name:"",organization:""}));}}><option value="manual">Umum / input manual</option><option value="employee">Pegawai DKPP</option></select></label>
    {source==="employee" && <label className="grid gap-2 text-sm font-medium">Pilih pegawai (ketik nama atau NIP)<input aria-label="Pilih pegawai (ketik nama atau NIP)" className={selectClass} list="library-employees" required disabled={Boolean(visitor)} value={values.employeeNip} onChange={e=>{const nip=e.target.value, employee=employees.find(v=>v.nip===nip);setValues(v=>({...v,employeeNip:nip,name:employee?.name??"",organization:employee?.unit??""}));}} /><datalist id="library-employees">{employees.map(e=><option key={e.nip} value={e.nip}>{e.name} · {e.unit}</option>)}</datalist></label>}
    <LibraryField label="Nama pengunjung" required disabled={source==="employee"} value={values.name} maxLength={200} onChange={v=>change("name",v)} /><LibraryField label="Instansi / unit" disabled={source==="employee"} value={values.organization} maxLength={300} onChange={v=>change("organization",v)} /><LibraryField label="Nomor telepon (opsional)" value={values.phone} maxLength={50} onChange={v=>change("phone",v)} /><LibraryField label="Alamat (opsional)" value={values.address} onChange={v=>change("address",v)} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.isActive} onChange={e=>change("isActive",e.target.checked)} />Pengunjung aktif</label></fieldset>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={done}>Batal</Button><Button type="submit" disabled={busy}>{busy?"Menyimpan…":"Simpan pengunjung"}</Button></DialogFooter></form>;
}
function VisitEditor({initialId,visitors,today,done}:{initialId:string;visitors:LibraryVisitor[];today:string;done:()=>void}) {
  const [values,setValues]=useState({visitorId:initialId,visitDate:today,purpose:""}), [busy,setBusy]=useState(false), [error,setError]=useState("");
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{await libraryRequest("visits","POST",values);toast.success("Kunjungan dicatat.");done();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4"><label className="grid gap-2 text-sm font-medium">Pengunjung<select aria-label="Pengunjung" className={selectClass} required value={values.visitorId} onChange={e=>setValues(v=>({...v,visitorId:e.target.value}))}><option value="">Pilih pengunjung</option>{visitors.filter(v=>v.isActive).map(v=><option key={v.id} value={v.id}>{v.name} · {v.cardNumber}</option>)}</select></label><LibraryField label="Tanggal kunjungan" type="date" required value={values.visitDate} onChange={v=>setValues(x=>({...x,visitDate:v}))} /><LibraryField label="Keperluan" value={values.purpose} onChange={v=>setValues(x=>({...x,purpose:v}))} /></fieldset>{error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={done}>Batal</Button><Button type="submit" disabled={busy}>{busy?"Menyimpan…":"Simpan kunjungan"}</Button></DialogFooter></form>;
}
