"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function BookCover({ src, title, className }: { src: string | null; title: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className={cn("relative grid aspect-[3/4] shrink-0 place-items-center overflow-hidden rounded-md border border-emerald-100 bg-emerald-50 text-emerald-700", className)}>
      {src && failed !== src
        ? <Image src={src} alt={`Cover ${title}`} fill unoptimized className="object-contain" onError={() => setFailed(src)} />
        : <BookOpen aria-hidden="true" className="size-5" />}
    </span>
  );
}
