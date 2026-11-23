"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, FilterX, ListFilter, Search, SearchX } from "lucide-react";
import { flexRender, type ColumnFiltersState, type ColumnVisibilityState, type PaginationState, type SortingState } from "@tanstack/react-table";
import { useLegacyTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel, type LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type NewsTableFilter = { id: string; label: string; type?: "date"; options?: { value: string; label: string }[] };
const all = "__all__";
export function NewsDataTable<T extends { id: string }>({ data, columns, filters, initialSearch = "", initialFilters = [], label }: {
  data: T[]; columns: LegacyColumnDef<T>[]; filters: NewsTableFilter[]; initialSearch?: string; initialFilters?: ColumnFiltersState; label: string;
}) {
  const [globalFilter, setGlobalFilter] = useState(initialSearch);
  const [columnFilters, setColumnFilters] = useState(initialFilters);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  // TanStack's legacy adapter exposes the shadcn Data Table API used by this project.
  const table = useLegacyTable({ data, columns, getRowId: row => row.id,
    state: { globalFilter, columnFilters, sorting, pagination, columnVisibility }, onColumnVisibilityChange: setColumnVisibility, onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters, onSortingChange: setSorting, onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
  });
  const rows = table.getRowModel().rows;
  const count = table.getFilteredRowModel().rows.length;
  function filter(id: string, value: string) {
    table.getColumn(id)?.setFilterValue(value || undefined);
    table.setPageIndex(0);
  }
  return <section aria-label={label} className="min-w-0 space-y-3">
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="inline-flex items-center gap-2 text-sm font-semibold"><ListFilter className="size-4 text-primary" aria-hidden/> Cari dan filter{columnFilters.length > 0 && <span className="rounded-full bg-primary/10 px-2 text-xs text-primary">{columnFilters.length} aktif</span>}</p><DropdownMenu><DropdownMenuTrigger render={<Button variant="outline"/>}><Columns3 aria-hidden/> Kolom</DropdownMenuTrigger><DropdownMenuContent align="end">{table.getAllLeafColumns().filter(column => !["title", "name", "actions"].includes(column.id)).map(column => <DropdownMenuCheckboxItem key={column.id} checked={column.getIsVisible()} onCheckedChange={checked => column.toggleVisibility(!!checked)}>{String(column.columnDef.header)}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu></div>
      <div className="flex flex-wrap items-end gap-3">
      <label className="grid min-w-0 flex-[1_1_13rem] gap-1 text-sm font-medium">Cari
        <span className="relative"><Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input className="h-10 pl-9" placeholder={`Cari ${label.toLowerCase()}…`} value={globalFilter} maxLength={160} onChange={event => { table.setGlobalFilter(event.target.value); table.setPageIndex(0); }}/></span>
      </label>
      {filters.map(({ id, label, options, type }) => {
        const value = String(table.getColumn(id)?.getFilterValue() ?? "");
        return options ? <div key={id} className="grid gap-1 text-sm font-medium"><span id={`news-filter-${id}`}>{label}</span>
          <Select value={value || all} onValueChange={value => filter(id, value === all ? "" : value ?? "")}>
            <SelectTrigger aria-labelledby={`news-filter-${id}`} className="h-10! min-w-28 max-w-56"><SelectValue>{options.find(option => option.value === value)?.label ?? "Semua"}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value={all}>Semua</SelectItem>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select></div> : <label key={id} className="grid gap-1 text-sm font-medium">{label}<Input className="h-10" type={type ?? "text"} maxLength={160} value={value} onChange={event => filter(id, event.target.value)}/></label>;
      })}
      <Button variant="outline" className="h-10" disabled={!globalFilter && !columnFilters.length} onClick={() => { setGlobalFilter(""); setColumnFilters([]); table.setPageIndex(0); }}><FilterX aria-hidden/> Reset filter</Button>
      </div>
    </div>
    <Table aria-label={label} containerProps={{ tabIndex: 0, role: "region", "aria-label": `Gulir tabel ${label}`, className: "rounded-xl border bg-card" }}>
      <TableHeader className="bg-primary/5">{table.getHeaderGroups().map(group => <TableRow key={group.id}>{group.headers.map(header => {
        const sorted = header.column.getIsSorted();
        const content = flexRender(header.column.columnDef.header, header.getContext());
        const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
        return <TableHead key={header.id} scope="col" aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}>
          {header.column.getCanSort() ? <Button variant="ghost" onClick={header.column.getToggleSortingHandler()}>{content}<Icon aria-hidden/></Button> : content}
        </TableHead>;
      })}</TableRow>)}</TableHeader>
      <TableBody>{rows.length ? rows.map(row => <TableRow key={row.id}>{row.getVisibleCells().map(cell => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) :
        <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center text-muted-foreground"><span className="inline-flex items-center gap-2"><SearchX aria-hidden className="size-4"/>{data.length ? "Tidak ada hasil yang cocok." : "Belum ada data."}</span></TableCell></TableRow>}
      </TableBody>
    </Table>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <p role="status">{count} dari {data.length} data</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">Baris<select className="h-8 rounded-md border bg-background px-2" value={pagination.pageSize} onChange={event => { table.setPageSize(Number(event.target.value)); table.setPageIndex(0); }}>{[10, 20, 50].map(size => <option key={size}>{size}</option>)}</select></label>
        <span>Halaman {count ? pagination.pageIndex + 1 : 0} / {table.getPageCount()}</span>
        <Button variant="outline" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}><ChevronLeft aria-hidden/> Sebelumnya</Button>
        <Button variant="outline" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Berikutnya <ChevronRight aria-hidden/></Button>
      </div>
    </div>
  </section>;
}
