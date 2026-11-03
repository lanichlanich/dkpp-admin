"use client";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SPJ_ARCHIVE_PAGE_SIZES } from "@/lib/spj-archive";
import { cn } from "@/lib/utils";
import { spjActionClass, spjSelectClass } from "./shared";

export function useSpjPagination<T>(items: T[]) {
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const page = Math.min(pagination.page, Math.max(1, Math.ceil(items.length / pagination.pageSize)));
  if (page !== pagination.page) setPagination({ ...pagination, page });
  return {
    items: items.slice((page - 1) * pagination.pageSize, page * pagination.pageSize),
    total: items.length, page, pageSize: pagination.pageSize,
    setPage: (next: number) => setPagination(value => ({ ...value, page: next })),
    setPageSize: (pageSize: number) => setPagination({ page: 1, pageSize }),
  };
}

export function SpjPagination({ id, label, itemLabel, total, page, pageSize, onPageChange, onPageSizeChange, disabled = false }: {
  id: string; label: string; itemLabel: string; total: number; page: number; pageSize: number;
  onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void; disabled?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total ? (page - 1) * pageSize + 1 : 0, last = Math.min(page * pageSize, total);
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  return <div className="flex flex-wrap items-center justify-between gap-3">
    <p role="status" className="text-sm text-zinc-500">Menampilkan {first.toLocaleString("id-ID")}–{last.toLocaleString("id-ID")} dari {total.toLocaleString("id-ID")} {itemLabel}</p>
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2"><Label htmlFor={id} className="whitespace-nowrap">Baris per halaman</Label><select id={id} value={pageSize} disabled={disabled} className={cn(spjSelectClass, "w-24 shrink-0 disabled:opacity-50")} onChange={e => onPageSizeChange(Number(e.target.value))}>{SPJ_ARCHIVE_PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}</select></div>
      <nav aria-label={`Pagination ${label}`} className="flex flex-wrap items-center gap-1">
        <Button type="button" variant="outline" size="sm" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>Sebelumnya</Button>
        {pages.map((number, i) => <Fragment key={number}>{i > 0 && number - pages[i - 1] > 1 && <span aria-hidden="true" className="px-1 text-zinc-500">…</span>}<Button type="button" variant="outline" size="sm" aria-label={`Ke halaman ${number}`} aria-current={number === page ? "page" : undefined} className={number === page ? spjActionClass.primary : undefined} disabled={disabled} onClick={() => onPageChange(number)}>{number}</Button></Fragment>)}
        <Button type="button" variant="outline" size="sm" disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}>Berikutnya</Button>
      </nav>
    </div>
  </div>;
}
