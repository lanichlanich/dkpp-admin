"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeftRight, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, Search, Trash2, UserCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { type ColumnFiltersState, type ColumnVisibilityState, type PaginationState, type RowSelectionState, type SortingState, flexRender } from "@tanstack/react-table";
import { type LegacyColumnDef, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useLegacyTable } from "@tanstack/react-table/legacy";
import { bulkEmployeeAction } from "@/actions/employees";
import { EmployeeDetailDialog } from "@/components/employees/employee-detail-dialog";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Employee } from "@/lib/db";
import type { EmployeeOptions } from "@/lib/employees";
import { formatRetirementAge } from "@/lib/retirement-age";

const columnLabels: Record<string, string> = {
  nip: "NIP",
  name: "Nama",
  parentUnit: "Unor Induk",
  unit: "Unor",
  position: "Jabatan",
  positionType: "Jenis Jabatan",
  echelon: "Eselon",
  rank: "Gol/Pangkat",
  retirementAge: "BUP",
  asnType: "ASN",
  status: "Status",
};

function SortButton({ column, children }: { column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc?: boolean) => void }; children: React.ReactNode }) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return <Button variant="ghost" size="sm" className="-ml-2" onClick={() => column.toggleSorting(sorted === "asc")} aria-label={`Urutkan ${String(children)}`}>{children}<Icon className="size-3.5" /></Button>;
}

export function EmployeeDataTable({ data, options }: { data: Employee[]; options: EmployeeOptions }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
    { id: "status", value: "Aktif" },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({ parentUnit: false, positionType: false, echelon: false, rank: false });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const columns = useMemo<LegacyColumnDef<Employee>[]>(() => [
    {
      id: "select",
      header: ({ table }) => <Checkbox checked={table.getIsAllPageRowsSelected()} indeterminate={!table.getIsAllPageRowsSelected() && table.getIsSomePageRowsSelected()} onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))} aria-label="Pilih semua baris pada halaman" />,
      cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(Boolean(value))} aria-label={`Pilih ${row.original.name}`} />,
      enableSorting: false,
      enableHiding: false,
    },
    { accessorKey: "nip", header: ({ column }) => <SortButton column={column}>NIP</SortButton>, cell: ({ row }) => <span className="font-mono text-xs text-zinc-700">{row.original.nip}</span> },
    { accessorKey: "name", header: ({ column }) => <SortButton column={column}>Nama</SortButton>, cell: ({ row }) => <div className="min-w-44"><p className="font-medium text-zinc-900">{row.original.name}</p><p className="mt-0.5 max-w-64 truncate text-xs text-zinc-500">{row.original.position}</p></div> },
    { accessorKey: "parentUnit", header: ({ column }) => <SortButton column={column}>Unor Induk</SortButton>, cell: ({ row }) => <span className="block max-w-72 truncate text-xs">{row.original.parentUnit}</span> },
    { accessorKey: "unit", header: ({ column }) => <SortButton column={column}>Unor</SortButton>, cell: ({ row }) => <span className="block max-w-64 truncate text-xs">{row.original.unit}</span> },
    { accessorKey: "position", header: ({ column }) => <SortButton column={column}>Jabatan</SortButton>, cell: ({ row }) => <span className="block max-w-72 truncate text-xs">{row.original.position}</span> },
    { accessorKey: "positionType", header: "Jenis Jabatan" },
    { accessorKey: "echelon", header: "Eselon" },
    { accessorKey: "rank", header: "Gol/Pangkat" },
    { accessorKey: "retirementAge", header: ({ column }) => <SortButton column={column}>BUP</SortButton>, cell: ({ row }) => <Badge variant="outline">{formatRetirementAge(row.original.retirementAge)}</Badge> },
    { accessorKey: "asnType", header: ({ column }) => <SortButton column={column}>ASN</SortButton>, cell: ({ row }) => <Badge variant="secondary">{row.original.asnType}</Badge> },
    { accessorKey: "status", header: ({ column }) => <SortButton column={column}>Status</SortButton>, cell: ({ row }) => <Badge className={row.original.status === "Aktif" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : row.original.status === "Mutasi" ? "bg-sky-50 text-sky-700 hover:bg-sky-50" : "bg-amber-50 text-amber-700 hover:bg-amber-50"}>{row.original.status}</Badge> },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <EmployeeDetailDialog employee={row.original} />
          <EmployeeFormDialog employee={row.original} options={options} />
        </div>
      ),
      enableHiding: false,
    },
  ], [options]);

  // TanStack v9 provides this compatibility hook for the stable v8-style controlled state API.
  const table = useLegacyTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, rowSelection, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getRowId: (row) => row.nip,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const selectedNips = table.getSelectedRowModel().rows.map((row) => row.original.nip);

  function runBulk(operation: "activate" | "retire" | "mutate" | "delete") {
    if (selectedNips.length === 0) {
      toast.warning("Pilih minimal satu pegawai.");
      return;
    }
    startTransition(async () => {
      const result = await bulkEmployeeAction({ nips: selectedNips, operation });
      if (result.success) {
        if (operation === "delete") toast.warning(result.message);
        else toast.success(result.message);
        setRowSelection({});
        setDeleteOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="Cari NIP, nama, unor, atau jabatan..." className="h-10 pl-9" /></div>
          <select value={(table.getColumn("status")?.getFilterValue() as string) ?? ""} onChange={(event) => table.getColumn("status")?.setFilterValue(event.target.value || undefined)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"><option value="">Semua status</option>{options.statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
          <select value={(table.getColumn("asnType")?.getFilterValue() as string) ?? ""} onChange={(event) => table.getColumn("asnType")?.setFilterValue(event.target.value || undefined)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"><option value="">Semua ASN</option>{options.asnTypes.map((asn) => <option key={asn} value={asn}>{asn}</option>)}</select>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}><Columns3 className="size-4" />Kolom</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">{table.getAllColumns().filter((column) => column.getCanHide()).map((column) => <DropdownMenuCheckboxItem key={column.id} checked={column.getIsVisible()} onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}>{columnLabels[column.id] ?? column.id}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
        </DropdownMenu>
      </div>

      {selectedNips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2.5"><p className="mr-2 text-sm font-medium text-indigo-900">{selectedNips.length} dipilih</p><Button variant="outline" size="sm" disabled={pending} onClick={() => runBulk("activate")}><UserCheck className="size-3.5" />Aktifkan</Button><Button variant="outline" size="sm" disabled={pending} onClick={() => runBulk("mutate")}><ArrowLeftRight className="size-3.5" />Mutasikan</Button><Button variant="outline" size="sm" disabled={pending} onClick={() => runBulk("retire")}><UserMinus className="size-3.5" />Pensiunkan</Button><Button variant="destructive" size="sm" disabled={pending} onClick={() => setDeleteOpen(true)}><Trash2 className="size-3.5" />Hapus</Button></div>
      )}

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>{table.getHeaderGroups().map((headerGroup) => <TableRow key={headerGroup.id}>{headerGroup.headers.map((header) => <TableHead key={header.id} className={header.id === "select" ? "w-10 pl-4" : "whitespace-nowrap"}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className={cell.column.id === "select" ? "pl-4" : undefined}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length} className="h-32 text-center text-zinc-500">Data pegawai tidak ditemukan.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500">Menampilkan {table.getRowModel().rows.length} dari {table.getFilteredRowModel().rows.length} data · Total {data.length} pegawai</p>
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-zinc-500">Baris</span><select value={table.getState().pagination.pageSize} onChange={(event) => table.setPageSize(Number(event.target.value))} className="h-8 rounded-lg border bg-white px-2 text-sm">{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select><span className="mx-2 text-sm text-zinc-600">Halaman {table.getState().pagination.pageIndex + 1} dari {Math.max(table.getPageCount(), 1)}</span><Button variant="outline" size="icon-sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="Halaman pertama"><ChevronsLeft /></Button><Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Halaman sebelumnya"><ChevronLeft /></Button><Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Halaman berikutnya"><ChevronRight /></Button><Button variant="outline" size="icon-sm" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} aria-label="Halaman terakhir"><ChevronsRight /></Button></div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus {selectedNips.length} pegawai?</AlertDialogTitle><AlertDialogDescription>Tindakan ini akan menghapus data terpilih secara permanen dari database dan tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={pending} onClick={() => runBulk("delete")}><Trash2 className="size-4" />Hapus permanen</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
