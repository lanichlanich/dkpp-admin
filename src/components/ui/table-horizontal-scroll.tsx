"use client";

import { useCallback, useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";

export function TableHorizontalScroll({ label, ...props }: ComponentProps<"table"> & { label: string }) {
  const viewport = useRef<HTMLDivElement>(null), table = useRef<HTMLTableElement>(null);
  const id = useId(), viewportId = `${id}-viewport`, sliderId = `${id}-slider`;
  const [position, setPosition] = useState({ left: 0, max: 0 });
  const update = useCallback(() => {
    const node = viewport.current;
    if (!node) return;
    const max = Math.max(0, node.scrollWidth - node.clientWidth), left = Math.min(max, Math.max(0, Math.round(node.scrollLeft)));
    setPosition(previous => previous.left === left && previous.max === max ? previous : { left, max });
  }, []);
  useEffect(() => {
    const node = viewport.current, content = table.current;
    if (!node || !content) return;
    const observer = new ResizeObserver(update);
    observer.observe(node); observer.observe(content);
    const frame = requestAnimationFrame(update);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [update]);
  function move(direction: number) {
    const node = viewport.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(160, node.clientWidth * 0.7), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  function seek(left: number) {
    const node = viewport.current;
    if (!node) return;
    node.scrollLeft = left;
    update();
  }
  return <div>
    <div hidden={position.max <= 1} role="group" aria-label={`Navigasi kolom ${label}`} className="sticky top-16 z-10 flex items-center gap-2 border-y bg-white/95 px-4 py-2 shadow-sm backdrop-blur">
      <label htmlFor={sliderId} className="shrink-0 text-xs font-medium text-zinc-600">Geser kolom</label>
      <Button type="button" variant="outline" size="icon-sm" aria-label={`Geser ${label} ke kiri`} aria-controls={viewportId} disabled={position.left <= 1} onClick={() => move(-1)}><ChevronLeft aria-hidden="true" className="size-4" /></Button>
      <input id={sliderId} type="range" min={0} max={Math.max(1, position.max)} step={1} value={position.left} onChange={event => seek(Number(event.target.value))} aria-label={`Geser kolom ${label}`} aria-controls={viewportId} aria-valuetext={`${Math.round(position.max ? position.left / position.max * 100 : 0)}% ke kanan`} className="h-7 min-w-0 flex-1 cursor-pointer accent-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500" />
      <Button type="button" variant="outline" size="icon-sm" aria-label={`Geser ${label} ke kanan`} aria-controls={viewportId} disabled={position.max - position.left <= 1} onClick={() => move(1)}><ChevronRight aria-hidden="true" className="size-4" /></Button>
    </div>
    <Table {...props} ref={table} containerProps={{ ref: viewport, id: viewportId, role: "region", "aria-label": `Kolom ${label}`, tabIndex: 0, onScroll: update, className: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500" }} />
  </div>;
}
