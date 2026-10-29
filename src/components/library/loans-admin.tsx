"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { loanStatus, type LibraryBook, type LibraryLoan, type LibraryVisitor } from "@/lib/library-types";
import { LibraryField, libraryRequest, selectClass, dateLabel } from "./admin-shared";

type VisitorOption = Pick<LibraryVisitor,"id"|"name"|"cardNumber">;
type PickerOption = { id: string; title: string; detail: string; keywords?: string[] };
function LoanPicker({ label, placeholder, searchPlaceholder, emptyMessage, options, value, onChange, disabled }: {
  label: string; placeholder: string; searchPlaceholder: string; emptyMessage: string;
  options: PickerOption[]; value: string; onChange: (id: string) => void; disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const id = useId();
  const selected = options.find(option => option.id === value);
  return <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Popover open={open} onOpenChange={next => { setOpen(next); if (next) setQuery(""); }}>
      <PopoverTrigger render={<Button id={id} type="button" variant="outline" role="combobox" aria-label={label} aria-required="true" aria-expanded={open} disabled={disabled} className="h-auto min-h-10 w-full justify-between whitespace-normal text-left font-normal" />}>
        <span className="min-w-0 break-words">{selected ? <><span className="block">{selected.title}</span><span className="mt-1 block text-xs text-zinc-500">{selected.detail}</span></> : placeholder}</span>
        <ChevronsUpDown aria-hidden="true" className="ml-2 size-4 shrink-0 text-zinc-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(32rem,calc(100vw-3rem))] p-0">
        <Command defaultValue={value} filter={(itemId, search, keywords) => {
          const text = (keywords?.join(" ") ?? itemId).toLocaleLowerCase("id-ID");
          return search.trim().toLocaleLowerCase("id-ID").split(/\s+/).every(word => text.includes(word)) ? 1 : 0;
        }}>
          <CommandInput aria-label={searchPlaceholder} placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList><CommandEmpty>{emptyMessage}</CommandEmpty><CommandGroup>
            {options.map(option => <CommandItem key={option.id} value={option.id} keywords={[option.title, option.detail, ...(option.keywords ?? [])]} data-checked={option.id === value} disabled={disabled} onSelect={() => { onChange(option.id); setOpen(false); }}>
              <span className="min-w-0"><span className="block break-words">{option.title}</span><span className="mt-1 block break-words text-xs text-zinc-500">{option.detail}</span></span>
            </CommandItem>)}
          </CommandGroup></CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>;
}
export function LoansAdmin({loans,books,visitors,today}:{loans:LibraryLoan[];books:LibraryBook[];visitors:VisitorOption[];today:string}) {
  const [search,setSearch]=useState(""), [status,setStatus]=useState(""), [page,setPage]=useState(1), [add,setAdd]=useState(false), [returning,setReturning]=useState<LibraryLoan|null>(null);
  const router=useRouter(), done=()=>{setAdd(false);setReturning(null);router.refresh();};
  const filtered=loans.filter(l=>(!status||loanStatus(l,today)===status)&&`${l.title} ${l.name} ${l.inventoryCode} ${l.cardNumber}`.toLowerCase().includes(search.toLowerCase()));
  const pages=Math.max(1,Math.ceil(filtered.length/20)),current=Math.min(page,pages),overdue=loans.filter(l=>loanStatus(l,today)==="Terlambat").length;
  return <div className="space-y-4"><div className="flex flex-wrap items-center gap-3"><Input aria-label="Cari peminjaman" className="max-w-md" placeholder="Cari buku, pengunjung, atau nomor kartu…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} /><select aria-label="Status peminjaman" className={`${selectClass} sm:w-44`} value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">Semua status</option>{["Dipinjam","Terlambat","Dikembalikan"].map(s=><option key={s}>{s}</option>)}</select><Button className="sm:ml-auto" onClick={()=>setAdd(true)}><Plus className="size-4" />Tambah peminjaman</Button></div>
    <p className="text-sm text-zinc-500">{loans.filter(l=>!l.returnDate).length} peminjaman aktif · <span className={overdue?"font-medium text-rose-700":""}>{overdue} terlambat</span></p>
    <div className="rounded-xl border bg-white"><Table><TableHeader><TableRow><TableHead>Buku</TableHead><TableHead>Peminjam</TableHead><TableHead>Jumlah</TableHead><TableHead>Pinjam / jatuh tempo</TableHead><TableHead>Status</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader><TableBody>{filtered.slice((current-1)*20,current*20).map(l=><TableRow key={l.id}><TableCell className="min-w-56 max-w-sm whitespace-normal"><p className="font-medium">{l.title}</p><p className="mt-1 font-mono text-xs text-zinc-500">{l.inventoryCode}</p>{l.notes&&<p className="mt-1 text-xs text-zinc-500">{l.notes}</p>}</TableCell><TableCell>{l.name}<p className="mt-1 font-mono text-xs text-zinc-500">{l.cardNumber}</p></TableCell><TableCell>{l.quantity}</TableCell><TableCell>{dateLabel(l.loanDate)}<p className="mt-1 text-xs text-zinc-500">s.d. {dateLabel(l.dueDate)}</p></TableCell><TableCell><span className={`rounded-full px-2 py-1 text-xs font-medium ${l.returnDate?"bg-zinc-100 text-zinc-700":l.dueDate<today?"bg-rose-100 text-rose-800":"bg-amber-100 text-amber-900"}`}>{loanStatus(l,today)}</span>{l.returnDate&&<p className="mt-2 text-xs text-zinc-500">{dateLabel(l.returnDate)}</p>}</TableCell><TableCell>{!l.returnDate&&<Button size="sm" variant="outline" onClick={()=>setReturning(l)}><RotateCcw className="size-4" />Kembalikan</Button>}</TableCell></TableRow>)}{!filtered.length&&<TableRow><TableCell colSpan={6} className="py-10 text-center text-zinc-500">Belum ada peminjaman yang sesuai.</TableCell></TableRow>}</TableBody></Table></div>
    <div className="flex items-center justify-between"><Button variant="outline" disabled={current<=1} onClick={()=>setPage(current-1)}>Sebelumnya</Button><span className="text-sm text-zinc-500">{current} / {pages}</span><Button variant="outline" disabled={current>=pages} onClick={()=>setPage(current+1)}>Berikutnya</Button></div>
    <Dialog open={add} onOpenChange={setAdd}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Tambah peminjaman</DialogTitle><DialogDescription>Pilih pengunjung terdaftar dan buku yang tersedia. Stok diperiksa kembali saat disimpan.</DialogDescription></DialogHeader>{add&&<LoanEditor books={books} visitors={visitors} today={today} done={done} />}</DialogContent></Dialog>
    <Dialog open={Boolean(returning)} onOpenChange={open=>{if(!open)setReturning(null);}}><DialogContent><DialogHeader><DialogTitle>Pengembalian buku</DialogTitle><DialogDescription>{returning?.name}: {returning?.title}. Seluruh {returning?.quantity} eksemplar pada transaksi ini akan dikembalikan.</DialogDescription></DialogHeader>{returning&&<ReturnEditor key={returning.id} loan={returning} today={today} done={done} />}</DialogContent></Dialog>
  </div>;
}
function LoanEditor({books,visitors,today,done}:{books:LibraryBook[];visitors:VisitorOption[];today:string;done:()=>void}) {
  const due = new Date(`${today}T00:00:00Z`);due.setUTCDate(due.getUTCDate()+7);
  const [values,setValues]=useState({bookId:"",visitorId:"",quantity:1,loanDate:today,dueDate:due.toISOString().slice(0,10),notes:""}), [busy,setBusy]=useState(false), [error,setError]=useState("");
  const change=(key:keyof typeof values,value:string|number)=>{setValues(v=>({...v,[key]:value}));setError("");};
  const book=books.find(b=>b.id===values.bookId);
  async function submit(e:React.FormEvent){e.preventDefault();if(!values.bookId||!values.visitorId){setError("Pilih buku dan peminjam terlebih dahulu.");return;}setBusy(true);setError("");try{await libraryRequest("loans","POST",values);toast.success("Peminjaman disimpan.");done();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <form className="space-y-4" onSubmit={submit}><fieldset disabled={busy} className="space-y-4">
    <LoanPicker label="Buku" placeholder="Cari dan pilih buku…" searchPlaceholder="Cari judul, kode inventaris, atau ISBN…" emptyMessage="Buku tersedia tidak ditemukan." value={values.bookId} onChange={id=>change("bookId",id)} disabled={busy} options={books.filter(b=>b.available>0).map(b=>({id:b.id,title:b.title,detail:`${b.inventoryCode} · ${b.available} tersedia`,keywords:[b.isbn]}))} />
    {book&&<p className="text-sm text-emerald-700">{book.available} eksemplar tersedia</p>}
    <LoanPicker label="Peminjam" placeholder="Cari dan pilih peminjam…" searchPlaceholder="Cari nama atau nomor kartu…" emptyMessage="Peminjam tidak ditemukan." value={values.visitorId} onChange={id=>change("visitorId",id)} disabled={busy} options={visitors.map(v=>({id:v.id,title:v.name,detail:v.cardNumber}))} />
    {!visitors.length&&<p className="text-sm text-amber-800">Daftarkan pengunjung melalui menu Daftar Pengunjung terlebih dahulu.</p>}
    <LibraryField label="Jumlah eksemplar" required type="number" min={1} value={values.quantity} onChange={v=>change("quantity",Number(v))} /><div className="grid gap-4 sm:grid-cols-2"><LibraryField label="Tanggal pinjam" required type="date" value={values.loanDate} onChange={v=>change("loanDate",v)} /><LibraryField label="Jatuh tempo" required type="date" min={values.loanDate} value={values.dueDate} onChange={v=>change("dueDate",v)} /></div><LibraryField label="Catatan" value={values.notes} maxLength={1000} onChange={v=>change("notes",v)} /></fieldset>{error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={done}>Batal</Button><Button type="submit" disabled={busy||!visitors.length}>{busy?"Menyimpan…":"Simpan peminjaman"}</Button></DialogFooter></form>;
}
function ReturnEditor({loan,today,done}:{loan:LibraryLoan;today:string;done:()=>void}) {
  const [date,setDate]=useState(today),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{await libraryRequest(`loans/${loan.id}/return`,"POST",{returnDate:date});toast.success("Pengembalian dicatat. Stok tersedia diperbarui.");done();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <form className="space-y-4" onSubmit={submit}><LibraryField label="Tanggal kembali" required type="date" min={loan.loanDate} value={date} onChange={setDate} disabled={busy} />{error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={done}>Batal</Button><Button type="submit" disabled={busy}>{busy?"Menyimpan…":"Konfirmasi pengembalian"}</Button></DialogFooter></form>;
}
