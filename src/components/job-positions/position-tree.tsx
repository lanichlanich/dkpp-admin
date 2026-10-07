"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, ChevronDown, ChevronRight, GripVertical, LoaderCircle, Network, Pencil, Plus, Search, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { deleteJobPositionAction, moveJobPositionAction, saveJobPositionAction } from "@/actions/job-positions";
import { FieldError, FormMessage } from "@/components/auth/form-message";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { JobPosition } from "@/lib/job-positions";

type PositionNode = JobPosition & { children: PositionNode[] };
const positionTypeLabels: Record<string, string> = { JS: "Struktural", JF: "Fungsional", JFU: "Pelaksana" };

function makeTree(positions: JobPosition[]) {
  const byId = new Map<string, PositionNode>(positions.map((position) => [position.id, { ...position, children: [] }]));
  const roots: PositionNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (nodes: PositionNode[]) => {
    nodes.sort((left, right) => left.name.localeCompare(right.name, "id") || left.unit.localeCompare(right.unit, "id"));
    nodes.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}

function PositionEditor({ position, positions, open, onOpenChange }: {
  position: JobPosition | null; positions: JobPosition[]; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const [state, action] = useActionState(saveJobPositionAction, {});
  const router = useRouter();
  useEffect(() => {
    if (!state.submittedAt) return;
    if (state.status === "success") {
      toast.success(state.message);
      onOpenChange(false);
      router.refresh();
    } else if (state.message) toast.error(state.message);
  }, [state, router, onOpenChange]);

  const candidates = positions.filter((candidate) => candidate.id !== position?.id);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{position ? "Edit penempatan jabatan" : "Tambah jabatan"}</DialogTitle><DialogDescription>Jabatan yang sama pada unit berbeda disimpan sebagai penempatan terpisah agar struktur organisasinya tepat.</DialogDescription></DialogHeader>
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={position?.id ?? ""} />
        <FormMessage status={state.status} message={state.status === "error" ? state.message : undefined} />
        <div className="space-y-2"><Label htmlFor="position-name">Nama jabatan</Label><Input id="position-name" name="name" required maxLength={200} defaultValue={position?.name ?? ""} placeholder="Contoh: KEPALA DINAS KETAHANAN PANGAN DAN PERTANIAN" aria-invalid={Boolean(state.errors?.name)} /><FieldError messages={state.errors?.name} /></div>
        <div className="space-y-2"><Label htmlFor="position-unit">Unit organisasi</Label><Input id="position-unit" name="unit" required maxLength={200} defaultValue={position?.unit ?? ""} placeholder="Contoh: DINAS KETAHANAN PANGAN DAN PERTANIAN" aria-invalid={Boolean(state.errors?.unit)} /><FieldError messages={state.errors?.unit} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="position-type">Jenis jabatan</Label><select id="position-type" name="positionType" defaultValue={position?.positionType ?? "JS"} className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"><option value="JS">JS · Struktural</option><option value="JF">JF · Fungsional</option><option value="JFU">JFU · Pelaksana</option></select></div>
          <div className="space-y-2"><Label htmlFor="position-echelon">Eselon/jenjang</Label><Input id="position-echelon" name="echelon" required maxLength={30} defaultValue={position?.echelon ?? "NON"} placeholder="Misal: III.a atau NON" /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="parent-position">Atasan langsung</Label><select id="parent-position" name="parentId" defaultValue={position?.parentId ?? ""} className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"><option value="">Jabatan tertinggi / belum ditentukan</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.unit}</option>)}</select><p className="text-xs text-zinc-500">Server mencegah jabatan menjadi atasan bagi dirinya sendiri atau membentuk siklus.</p><FieldError messages={state.errors?.parentId} /></div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button type="submit" className="bg-indigo-600 text-white hover:bg-indigo-700">{position ? "Simpan perubahan" : "Tambah jabatan"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function PositionNodeRow({ node, depth, expandedIds, forceExpanded, onToggle, onEdit, onDelete, draggedId, dropTargetId, dragDisabled, onDragStart, onDragEnd, onDragOver, onDrop }: {
  node: PositionNode; depth: number; expandedIds: Set<string>; forceExpanded: boolean; onToggle: (id: string) => void; onEdit: (position: JobPosition) => void; onDelete: (position: JobPosition) => void;
  draggedId: string | null; dropTargetId: string | null; dragDisabled: boolean; onDragStart: (id: string) => void; onDragEnd: () => void; onDragOver: (id: string) => void; onDrop: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = forceExpanded || expandedIds.has(node.id);
  return <>
    <TableRow
      onDragOver={(event) => { if (dragDisabled || !draggedId || draggedId === node.id) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; onDragOver(node.id); }}
      onDrop={(event) => { if (dragDisabled || !draggedId) return; event.preventDefault(); event.stopPropagation(); onDrop(node.id); }}
      className={dropTargetId === node.id ? "bg-indigo-50 ring-2 ring-inset ring-indigo-400" : draggedId === node.id ? "opacity-50" : undefined}
    >
      <TableCell className="min-w-[26rem] py-3" style={{ paddingLeft: `${16 + Math.min(depth, 10) * 22}px` }}>
        <div className="flex items-start gap-2">
          <button type="button" draggable={!dragDisabled} disabled={dragDisabled} aria-label={`Seret ${node.name} untuk mengubah atasan`} title={dragDisabled ? "Kosongkan pencarian untuk mengaktifkan drag-and-drop" : "Seret ke jabatan atasan"} onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.setData("text/plain", node.id); event.dataTransfer.effectAllowed = "move"; onDragStart(node.id); }} onDragEnd={onDragEnd} className="mt-0.5 grid size-6 shrink-0 cursor-grab place-items-center rounded-md text-zinc-400 hover:bg-indigo-50 hover:text-indigo-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"><GripVertical className="size-4" /></button>
          <button type="button" aria-label={`${expanded ? "Ciutkan" : "Buka"} bawahan ${node.name}`} aria-expanded={expanded} onClick={() => onToggle(node.id)} className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-30" disabled={!hasChildren}>{hasChildren ? expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" /> : <span className="size-1.5 rounded-full bg-zinc-300" />}</button>
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><BriefcaseBusiness className="size-4" /></span>
          <div className="min-w-0"><p className="font-medium text-zinc-900">{node.name}</p><p className="mt-0.5 text-xs text-zinc-500">{node.unit}</p></div>
        </div>
      </TableCell>
      <TableCell className="min-w-28"><span className="block text-sm">{positionTypeLabels[node.positionType] ?? node.positionType}</span><span className="text-xs text-zinc-500">{node.positionType} · {node.echelon}</span></TableCell>
      <TableCell className="min-w-44 text-sm">{node.parentName ?? <span className="text-zinc-400">Belum ada atasan</span>}</TableCell>
      <TableCell className="min-w-32"><span className="inline-flex items-center gap-1.5 text-sm text-zinc-700"><UsersRound className="size-4 text-zinc-400" />{node.employeeCount} pegawai</span>{node.activeEmployeeCount !== node.employeeCount && <span className="mt-1 block pl-5 text-xs text-zinc-500">{node.activeEmployeeCount} aktif</span>}</TableCell>
      <TableCell className="min-w-24 pr-4"><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(node)} aria-label={`Edit ${node.name} di ${node.unit}`}><Pencil className="size-3.5" /></Button><Button type="button" variant="ghost" size="icon-sm" onClick={() => onDelete(node)} disabled={node.employeeCount > 0 || node.children.length > 0} aria-label={`Hapus ${node.name} di ${node.unit}`} title={node.employeeCount || node.children.length ? "Masih ada pegawai atau bawahan" : "Hapus jabatan"}><Trash2 className="size-3.5" /></Button></div></TableCell>
    </TableRow>
    {expanded && node.children.map((child) => <PositionNodeRow key={child.id} node={child} depth={depth + 1} expandedIds={expandedIds} forceExpanded={forceExpanded} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} draggedId={draggedId} dropTargetId={dropTargetId} dragDisabled={dragDisabled} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={onDragOver} onDrop={onDrop} />)}
  </>;
}

export function PositionTree({ positions }: { positions: JobPosition[] }) {
  const router = useRouter();
  const roots = useMemo(() => makeTree(positions), [positions]);
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<JobPosition | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(roots.map((root) => root.id)));
  const [toDelete, setToDelete] = useState<JobPosition | null>(null);
  const [deleting, startDelete] = useTransition();
  const [moving, startMove] = useTransition();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const matches = (node: PositionNode): boolean => {
    const own = `${node.name} ${node.unit} ${node.positionType} ${node.echelon} ${node.parentName ?? ""}`.toLocaleLowerCase("id-ID").includes(normalizedQuery);
    return own || node.children.some(matches);
  };
  const visibleRoots = normalizedQuery ? roots.filter(matches) : roots;

  function toggle(id: string) {
    setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function expandAll() {
    const ids = new Set<string>();
    const visit = (node: PositionNode) => { if (node.children.length) ids.add(node.id); node.children.forEach(visit); };
    roots.forEach(visit);
    setExpanded(ids);
  }
  function edit(position: JobPosition | null) { setSelected(position); setEditorOpen(true); }
  function deletePosition() {
    if (!toDelete) return;
    startDelete(async () => {
      const result = await deleteJobPositionAction(toDelete.id);
      if (!result.success) toast.error(result.message);
      else { toast.success(result.message); router.refresh(); }
      setToDelete(null);
    });
  }
  function movePosition(parentId: string | null) {
    if (!draggedId || moving) return;
    const id = draggedId;
    setDraggedId(null);
    setDropTargetId(null);
    startMove(async () => {
      const result = await moveJobPositionAction(id, parentId);
      if (!result.success) toast.error(result.message);
      else {
        toast.success(result.message);
        router.refresh();
      }
    });
  }

  return <>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><h2 className="font-semibold text-zinc-950">Struktur jabatan</h2><p className="mt-1 text-sm text-zinc-500">Seret ikon pegangan ke jabatan yang akan menjadi atasan langsung. Klik Edit untuk pengaturan lainnya.</p></div>
        <Button type="button" onClick={() => edit(null)} className="bg-indigo-600 text-white hover:bg-indigo-700"><Plus className="size-4" />Tambah jabatan</Button>
      </div>
      <div className="flex flex-col gap-3 border-b bg-zinc-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Cari nama jabatan, unit, atau atasan" aria-label="Cari jabatan" /></div>
        <div className="flex gap-2"><Button variant="outline" size="sm" type="button" onClick={expandAll}>Buka semua</Button><Button variant="outline" size="sm" type="button" onClick={() => setExpanded(new Set())}>Ciutkan semua</Button></div>
      </div>
      {!positions.length ? <div className="grid min-h-56 place-items-center p-6 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-full bg-indigo-50 text-indigo-600"><Network className="size-5" /></span><p className="mt-3 font-medium text-zinc-900">Belum ada jabatan</p><p className="mt-1 text-sm text-zinc-500">Tambahkan jabatan pertama untuk mulai membentuk hirarki.</p></div></div> : <>
        <div onDragOver={(event) => { if (!draggedId || normalizedQuery) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTargetId("__root__"); }} onDragLeave={() => setDropTargetId((current) => current === "__root__" ? null : current)} onDrop={(event) => { if (!draggedId || normalizedQuery) return; event.preventDefault(); movePosition(null); }} className={`mx-4 mt-4 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors sm:mx-5 ${dropTargetId === "__root__" ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-zinc-300 bg-zinc-50 text-zinc-500"}`}>
          {normalizedQuery ? "Kosongkan pencarian untuk menggunakan drag-and-drop." : draggedId ? "Lepaskan di sini untuk menjadikan jabatan ini sebagai jabatan tertinggi." : "Area lepas: jadikan jabatan sebagai jabatan tertinggi."}
        </div>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="pl-4">Jabatan / unit</TableHead><TableHead>Jenis / eselon</TableHead><TableHead>Atasan langsung</TableHead><TableHead>Pengisian</TableHead><TableHead className="pr-4 text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{visibleRoots.map((root) => <PositionNodeRow key={root.id} node={root} depth={0} expandedIds={expanded} forceExpanded={Boolean(normalizedQuery)} onToggle={toggle} onEdit={edit} onDelete={setToDelete} draggedId={draggedId} dropTargetId={dropTargetId} dragDisabled={Boolean(normalizedQuery) || moving} onDragStart={(id) => { setDraggedId(id); setDropTargetId(null); }} onDragEnd={() => { setDraggedId(null); setDropTargetId(null); }} onDragOver={setDropTargetId} onDrop={movePosition} />)}</TableBody></Table></div>
      </>}
      {normalizedQuery && !visibleRoots.length && <div className="p-10 text-center text-sm text-zinc-500">Tidak ada jabatan yang cocok dengan pencarian.</div>}
      <div className="flex items-center gap-2 border-t bg-zinc-50/60 px-4 py-3 text-xs text-zinc-500"><Network className="size-4 shrink-0" />Data pegawai dan hirarki jabatan tersimpan dalam satu katalog penempatan.</div>
    </section>
    {editorOpen && <PositionEditor key={selected?.id ?? "new"} position={selected} positions={positions} open={editorOpen} onOpenChange={setEditorOpen} />}
    <AlertDialog open={Boolean(toDelete)} onOpenChange={(isOpen) => { if (!isOpen && !deleting) setToDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus jabatan?</AlertDialogTitle><AlertDialogDescription>“{toDelete?.name} · {toDelete?.unit}” akan dihapus dari katalog. Penghapusan hanya tersedia jika tidak ada pegawai atau jabatan bawahan yang terhubung.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); deletePosition(); }} disabled={deleting} className="bg-red-600 text-white hover:bg-red-700">{deleting ? <><LoaderCircle className="animate-spin" />Menghapus...</> : "Hapus jabatan"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
