"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, ChevronRight, LoaderCircle, Pencil, Plus, Search, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { deleteOrganizationUnitAction, saveOrganizationUnitAction } from "@/actions/organization-units";
import { FieldError, FormMessage } from "@/components/auth/form-message";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrganizationUnit } from "@/lib/organization-units";

type UnitNode = OrganizationUnit & { children: UnitNode[] };

function makeTree(units: OrganizationUnit[]) {
  const byId = new Map<string, UnitNode>(units.map((unit) => [unit.id, { ...unit, children: [] }]));
  const roots: UnitNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (nodes: UnitNode[]) => {
    nodes.sort((left, right) => left.name.localeCompare(right.name, "id"));
    nodes.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}

function UnitEditor({ unit, units, open, onOpenChange }: {
  unit: OrganizationUnit | null; units: OrganizationUnit[]; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const [state, action, saving] = useActionState(saveOrganizationUnitAction, {});
  const router = useRouter();
  useEffect(() => {
    if (!state.submittedAt) return;
    if (state.status === "success") {
      toast.success(state.message);
      onOpenChange(false);
      router.refresh();
    } else if (state.message) toast.error(state.message);
  }, [state, router, onOpenChange]);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{unit ? "Edit unit organisasi" : "Tambah unit organisasi"}</DialogTitle><DialogDescription>Perubahan nama unit akan diperbarui pada jabatan dan data pegawai yang terhubung.</DialogDescription></DialogHeader>
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={unit?.id ?? ""} />
        <FormMessage status={state.status} message={state.status === "error" ? state.message : undefined} />
        <div className="space-y-2"><Label htmlFor="organization-unit-name">Nama unit organisasi</Label><Input id="organization-unit-name" name="name" required maxLength={200} defaultValue={unit?.name ?? ""} placeholder="Contoh: SEKRETARIAT DINAS ..." aria-invalid={Boolean(state.errors?.name)} /><FieldError messages={state.errors?.name} /></div>
        <div className="space-y-2"><Label htmlFor="organization-unit-parent">Unit induk</Label><select id="organization-unit-parent" name="parentId" defaultValue={unit?.parentId ?? ""} className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"><option value="">Unit tertinggi / belum ditentukan</option>{units.filter((candidate) => candidate.id !== unit?.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select><p className="text-xs text-zinc-500">Hirarki unit membantu mengelompokkan unit kerja. Sistem mencegah terbentuknya siklus.</p><FieldError messages={state.errors?.parentId} /></div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button><Button type="submit" disabled={saving} className="bg-indigo-600 text-white hover:bg-indigo-700">{saving ? <><LoaderCircle className="size-4 animate-spin" />Menyimpan...</> : unit ? "Simpan perubahan" : "Tambah unit"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function UnitRow({ node, depth, expanded, onToggle, onEdit, onDelete }: {
  node: UnitNode; depth: number; expanded: Set<string>; onToggle: (id: string) => void; onEdit: (unit: OrganizationUnit) => void; onDelete: (unit: OrganizationUnit) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  return <>
    <TableRow>
      <TableCell className="min-w-[24rem] py-3" style={{ paddingLeft: `${16 + Math.min(depth, 10) * 22}px` }}>
        <div className="flex items-start gap-2">
          <button type="button" aria-label={`${isExpanded ? "Ciutkan" : "Buka"} unit bawahan ${node.name}`} aria-expanded={isExpanded} onClick={() => onToggle(node.id)} disabled={!hasChildren} className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-30">{hasChildren ? isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" /> : <span className="size-1.5 rounded-full bg-zinc-300" />}</button>
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Building2 className="size-4" /></span>
          <div className="min-w-0"><p className="font-medium text-zinc-900">{node.name}</p><p className="mt-0.5 text-xs text-zinc-500">{node.parentName ? `Induk: ${node.parentName}` : "Unit tertinggi"}</p></div>
        </div>
      </TableCell>
      <TableCell className="min-w-32"><span className="inline-flex items-center gap-1.5 text-sm text-zinc-700"><UsersRound className="size-4 text-zinc-400" />{node.employeeCount} pegawai</span></TableCell>
      <TableCell className="min-w-28 text-sm text-zinc-700">{node.positionCount} jabatan</TableCell>
      <TableCell className="min-w-24 pr-4"><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(node)} aria-label={`Edit unit ${node.name}`}><Pencil className="size-3.5" /></Button><Button type="button" variant="ghost" size="icon-sm" onClick={() => onDelete(node)} disabled={node.positionCount > 0 || node.children.length > 0} aria-label={`Hapus unit ${node.name}`} title={node.positionCount || node.children.length ? "Masih ada jabatan atau unit bawahan" : "Hapus unit"}><Trash2 className="size-3.5" /></Button></div></TableCell>
    </TableRow>
    {isExpanded && node.children.map((child) => <UnitRow key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />)}
  </>;
}

export function OrganizationUnitList({ units }: { units: OrganizationUnit[] }) {
  const router = useRouter();
  const roots = useMemo(() => makeTree(units), [units]);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(roots.map((root) => root.id)));
  const [selected, setSelected] = useState<OrganizationUnit | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toDelete, setToDelete] = useState<OrganizationUnit | null>(null);
  const [deleting, startDelete] = useTransition();
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const matches = (node: UnitNode): boolean => node.name.toLocaleLowerCase("id-ID").includes(normalizedQuery) || node.children.some(matches);
  const visibleRoots = normalizedQuery ? roots.filter(matches) : roots;

  function toggle(id: string) {
    setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function edit(unit: OrganizationUnit | null) { setSelected(unit); setEditorOpen(true); }
  function deleteUnit() {
    if (!toDelete) return;
    startDelete(async () => {
      const result = await deleteOrganizationUnitAction(toDelete.id);
      if (!result.success) toast.error(result.message);
      else { toast.success(result.message); router.refresh(); }
      setToDelete(null);
    });
  }

  return <>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><h2 className="font-semibold text-zinc-950">Struktur unit organisasi</h2><p className="mt-1 text-sm text-zinc-500">Kelola unit dan unit induk. Jabatan serta pegawai menggunakan katalog unit ini.</p></div>
        <Button type="button" onClick={() => edit(null)} className="bg-indigo-600 text-white hover:bg-indigo-700"><Plus className="size-4" />Tambah unit</Button>
      </div>
      <div className="border-b bg-zinc-50/60 p-4"><div className="relative w-full sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Cari unit organisasi" aria-label="Cari unit organisasi" /></div></div>
      {!units.length ? <div className="grid min-h-56 place-items-center p-6 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Building2 className="size-5" /></span><p className="mt-3 font-medium text-zinc-900">Belum ada unit organisasi</p><p className="mt-1 text-sm text-zinc-500">Tambahkan unit pertama untuk menghubungkannya dengan jabatan dan pegawai.</p></div></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="pl-4">Unit organisasi</TableHead><TableHead>Pegawai</TableHead><TableHead>Jabatan</TableHead><TableHead className="pr-4 text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{visibleRoots.map((root) => <UnitRow key={root.id} node={root} depth={0} expanded={expanded} onToggle={toggle} onEdit={edit} onDelete={setToDelete} />)}</TableBody></Table></div>}
      {normalizedQuery && !visibleRoots.length && <div className="p-10 text-center text-sm text-zinc-500">Tidak ada unit yang cocok dengan pencarian.</div>}
      <div className="flex items-center gap-2 border-t bg-zinc-50/60 px-4 py-3 text-xs text-zinc-500"><Building2 className="size-4 shrink-0" />Nama unit pada jabatan dan pegawai diperbarui otomatis saat unit diedit.</div>
    </section>
    {editorOpen && <UnitEditor key={selected?.id ?? "new"} unit={selected} units={units} open={editorOpen} onOpenChange={setEditorOpen} />}
    <AlertDialog open={Boolean(toDelete)} onOpenChange={(isOpen) => { if (!isOpen && !deleting) setToDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus unit organisasi?</AlertDialogTitle><AlertDialogDescription>“{toDelete?.name}” akan dihapus. Penghapusan hanya tersedia jika unit tidak memiliki jabatan atau unit bawahan yang terhubung.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); deleteUnit(); }} disabled={deleting} className="bg-red-600 text-white hover:bg-red-700">{deleting ? <><LoaderCircle className="animate-spin" />Menghapus...</> : "Hapus unit"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
