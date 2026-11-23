"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { FolderOpen, LoaderCircle, Pencil, Plus, Save, Tag } from "lucide-react";
import { toast } from "sonner";
import { manageNewsAction } from "@/app/dashboard/berita/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { NewsTerm, NewsTermKind } from "@/lib/news";

export function NewsTermDialog({ kind, term }: { kind: NewsTermKind; term?: NewsTerm }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const submitted = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const label = kind === "category" ? "kategori" : "tag";
  const Icon = kind === "category" ? FolderOpen : Tag;

  function changeOpen(next: boolean) {
    if (submitted.current) return;
    if (next) { setName(term?.name ?? ""); setError(""); }
    setOpen(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    if (!name.trim()) { setError("Nama tidak boleh kosong."); input.current?.focus(); return; }
    const data = new FormData(event.currentTarget);
    submitted.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await manageNewsAction({ ok: false, message: "" }, data);
        if (!result.ok) { setError(result.message); return; }
        setOpen(false);
        toast.success(`${kind === "category" ? "Kategori" : "Tag"} berhasil ${term ? "diperbarui" : "ditambahkan"}.`);
      } catch {
        setError("Perubahan belum tersimpan. Silakan coba lagi.");
      } finally { submitted.current = false; }
    });
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger render={<Button type="button" variant={term ? "outline" : "default"} size={term ? "default" : "lg"} aria-label={term ? `Edit ${label} ${term.name}` : undefined}/>}>{term ? <Pencil aria-hidden/> : <Plus aria-hidden/>}{term ? "Edit" : `Tambah ${label}`}</DialogTrigger>
    <DialogContent initialFocus={input} showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <span className={`grid size-10 place-items-center rounded-xl ${kind === "category" ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" : "bg-violet-500/15 text-violet-700 dark:text-violet-300"}`}><Icon aria-hidden className="size-5"/></span>
        <DialogTitle>{term ? "Edit" : "Tambah"} {label}</DialogTitle>
        <DialogDescription>{term ? `Ubah nama ${label} tanpa menghapus kaitannya dengan berita.` : `Masukkan nama ${label} yang akan tersedia di editor berita.`}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
        <input type="hidden" name="operation" value="saveTerm"/>
        <input type="hidden" name="kind" value={kind}/>
        <input type="hidden" name="id" value={term?.id ?? ""}/>
        <input type="hidden" name="previousName" value={term?.name ?? ""}/>
        <div className="space-y-1.5">
          <label htmlFor={id} className="text-sm font-medium">Nama {label}</label>
          <Input id={id} ref={input} name="name" value={name} onChange={event => { setName(event.target.value); setError(""); }} placeholder={`Nama ${label}`} maxLength={60} required readOnly={pending} aria-invalid={error ? true : undefined} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} />
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">Maksimal 60 karakter.</p>
          {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => changeOpen(false)}>Batal</Button>
          <Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden/> : <Save aria-hidden/>}{pending ? "Menyimpan…" : "Simpan"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
