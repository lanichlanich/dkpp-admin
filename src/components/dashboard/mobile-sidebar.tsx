"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/dashboard/sidebar";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="size-11 lg:hidden" aria-label="Buka menu" />}><Menu className="size-5" /></SheetTrigger>
      <SheetContent side="left" className="w-72 max-w-[calc(100vw-2rem)] border-0 p-0" showCloseButton={false}>
        <SheetTitle className="sr-only">Navigasi dashboard</SheetTitle>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
