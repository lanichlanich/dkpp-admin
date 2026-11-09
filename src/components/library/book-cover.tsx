"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function BookCover({ src, title, className, preview = false }: { src: string | null; title: string; className?: string; preview?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const frame = cn("relative grid aspect-[3/4] shrink-0 place-items-center overflow-hidden rounded-md border border-emerald-100 bg-emerald-50 text-emerald-700", className);

  if (!src || failed === src) {
    return <span className={frame}><BookOpen aria-hidden="true" className="size-1/4 min-w-4 max-w-9" /></span>;
  }

  const alt = `Cover ${title}`;
  const thumbnail = <Image src={src} alt={alt} fill unoptimized className="object-contain" onError={() => setFailed(src)} />;
  if (!preview) return <span className={frame}>{thumbnail}</span>;

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        aria-label={`Perbesar cover ${title}`}
        className={cn(frame, "cursor-zoom-in transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2")}
      >
        {thumbnail}
        <span aria-hidden="true" className="absolute right-1 bottom-1 rounded-sm bg-zinc-900/80 p-1 text-white">
          <ZoomIn className="size-3.5" />
        </span>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="flex max-h-[calc(100dvh-2rem)] flex-col gap-3 sm:max-w-3xl">
        <DialogTitle className="line-clamp-2 pr-9 leading-snug wrap-anywhere">{title}</DialogTitle>
        <DialogClose
          aria-label="Tutup pratinjau cover"
          render={<Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" />}
        >
          <X aria-hidden="true" />
        </DialogClose>
        <div className="relative h-[min(72dvh,44rem)] min-h-0 rounded-md bg-zinc-100">
          <Image src={src} alt={alt} fill unoptimized loading="eager" className="object-contain" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
