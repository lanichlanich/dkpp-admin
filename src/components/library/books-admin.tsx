"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/table";
import type { LibraryBook, BookInput } from "@/lib/library-types";
import { LibraryField, libraryRequest } from "./admin-shared";

const empty: BookInput = { inventoryCode: "", title: "", publicationYear: "", publicationPlace: "", publisher: "", isbn: "", category: "", copies: 1, shelf: "", notes: "", isActive: true };
export function BooksAdmin({ books }: { books: LibraryBook[] }) {
  const [search, setSearch] = useState(""), [page, setPage] = useState(1), [edit, setEdit] = useState<LibraryBook | "new" | null>(null), [remove, setRemove] = useState<LibraryBook | null>(null), [busy, setBusy] = useState(false);
  const router = useRouter();
  const filtered = books.filter(b => `${b.title} ${b.inventoryCode} ${b.category} ${b.isbn}`.toLowerCase().includes(search.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 20)), current = Math.min(page, pages);
  async function deleteBook() {
    if (!remove) return; setBusy(true);
    try { await libraryRequest(`books/${remove.id}`, "DELETE", { confirmed: true, updatedAt: remove.updatedAt }); toast.success("Buku dihapus."); setRemove(null); router.refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><Input className="max-w-md" placeholder="Cari judul, kode, kategori, atau ISBN…" aria-label="Cari buku" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /><Button onClick={() => setEdit("new")}><Plus className="size-4" />Tambah buku</Button></div>
    <p className="text-sm text-zinc-500">{books.length} entri · {books.reduce((n,b) => n + b.copies,0)} eksemplar · {books.reduce((n,b) => n + b.borrowed,0)} dipinjam</p>
    <div className="rounded-xl border bg-white"><Table><TableHeader><TableRow><TableHead>Kode inventaris</TableHead><TableHead>Judul buku / pengarang</TableHead><TableHead>Kategori</TableHead><TableHead>Stok</TableHead><TableHead>Status</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader><TableBody>{filtered.slice((current-1)*20,current*20).map(b => <TableRow key={b.id}><TableCell className="align-top font-mono text-xs">{b.inventoryCode}</TableCell><TableCell className="min-w-64 max-w-lg whitespace-normal"><p className="font-medium">{b.title}</p><p className="mt-1 text-xs text-zinc-500">{b.publisher || "-"} · {b.publicationYear || "-"}</p></TableCell><TableCell className="whitespace-normal text-sm">{b.category || "-"}</TableCell><TableCell><p>{b.available} / {b.copies}</p><p className="text-xs text-zinc-500">tersedia / total</p></TableCell><TableCell>{b.isActive ? "Aktif" : "Nonaktif"}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${b.inventoryCode}`} onClick={() => setEdit(b)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={`Hapus ${b.inventoryCode}`} onClick={() => setRemove(b)}><Trash2 className="size-4 text-rose-600" /></Button></div></TableCell></TableRow>)}{filtered.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-zinc-500">Buku tidak ditemukan.</TableCell></TableRow>}</TableBody></Table></div>
    <div className="flex items-center justify-between"><Button variant="outline" disabled={current <= 1} onClick={() => setPage(current-1)}>Sebelumnya</Button><span className="text-sm text-zinc-500">{current} / {pages}</span><Button variant="outline" disabled={current >= pages} onClick={() => setPage(current+1)}>Berikutnya</Button></div>
    <Dialog open={edit !== null} onOpenChange={open => { if (!open) setEdit(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{edit === "new" ? "Tambah buku" : "Edit buku"}</DialogTitle><DialogDescription>Jumlah eksemplar adalah seluruh koleksi, termasuk yang sedang dipinjam. Nonaktifkan untuk menyembunyikan buku dari katalog publik.</DialogDescription></DialogHeader>{edit && <BookEditor key={typeof edit === "string" ? edit : edit.id} book={edit === "new" ? undefined : edit} done={() => { setEdit(null); router.refresh(); }} />}</DialogContent></Dialog>
    <AlertDialog open={Boolean(remove)} onOpenChange={open => { if (!open && !busy) setRemove(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus buku?</AlertDialogTitle><AlertDialogDescription>{remove?.title} (kode {remove?.inventoryCode}). Buku dengan riwayat peminjaman tidak dapat dihapus. Gunakan Edit untuk menonaktifkannya.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel><Button variant="destructive" disabled={busy} onClick={deleteBook}>{busy ? "Menghapus…" : "Hapus buku"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
function BookEditor({ book, done }: { book?: LibraryBook; done: () => void }) {
  const [values, setValues] = useState<BookInput>(book ? { ...book, isActive: Boolean(book.isActive) } : empty), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const change = (key: keyof BookInput, value: string | number | boolean) => setValues(v => ({ ...v, [key]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await libraryRequest(book ? `books/${book.id}` : "books", book ? "PATCH" : "POST", { ...values, updatedAt: book?.updatedAt }); toast.success("Buku disimpan."); done(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
    <LibraryField label="Kode inventaris" required value={values.inventoryCode} maxLength={80} onChange={v => change("inventoryCode",v)} /><LibraryField label="Judul buku / pengarang" required value={values.title} onChange={v => change("title",v)} />
    <LibraryField label="Tahun terbit" value={values.publicationYear} maxLength={20} onChange={v => change("publicationYear",v)} /><LibraryField label="Tempat terbit" value={values.publicationPlace} maxLength={200} onChange={v => change("publicationPlace",v)} />
    <LibraryField label="Penerbit" value={values.publisher} onChange={v => change("publisher",v)} /><LibraryField label="ISBN / ISSN" value={values.isbn} maxLength={100} onChange={v => change("isbn",v)} />
    <LibraryField label="Kategori / keterangan sumber" value={values.category} maxLength={100} onChange={v => change("category",v)} /><LibraryField label="Jumlah eksemplar" required type="number" min={book?.borrowed ?? 0} value={values.copies} onChange={v => change("copies",Number(v))} />
    <LibraryField label="Lokasi rak" value={values.shelf} maxLength={100} onChange={v => change("shelf",v)} /><LibraryField label="Catatan internal" value={values.notes} maxLength={1000} onChange={v => change("notes",v)} />
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.isActive} onChange={e => change("isActive",e.target.checked)} />Aktif di katalog publik</label>
  </fieldset>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={done}>Batal</Button><Button type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan buku"}</Button></DialogFooter></form>;
}
