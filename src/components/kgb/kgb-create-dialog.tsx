"use client";

import { useRef, useState } from "react";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { KgbEmployee } from "@/lib/kgb";
import type { SignatoryOption } from "@/lib/signatory";
import { KgbForm } from "./kgb-form";

export function KgbCreateDialog({ employees, signatories, onSaved }: {
  employees: KgbEmployee[];
  signatories: SignatoryOption[];
  onSaved: () => void;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  function close() {
    setConfirmClose(false);
    setDirty(false);
    setOpen(false);
  }

  function requestClose() {
    if (submitting) return;
    if (dirty) setConfirmClose(true);
    else close();
  }

  function changeOpen(next: boolean) {
    if (!next) {
      requestClose();
      return;
    }
    setFormKey(key => key + 1);
    setOpen(true);
  }

  return (
    <Dialog open={open} disablePointerDismissal onOpenChange={changeOpen}>
      <DialogTrigger render={<Button size="lg" className="w-full shrink-0 bg-indigo-700 text-white hover:bg-indigo-800 sm:w-auto" />}>
        <FilePlus2 />Tambah SK KGB
      </DialogTrigger>
      <DialogContent initialFocus={title} showCloseButton={!submitting} className="flex h-dvh max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[90dvh] sm:max-w-[min(58rem,calc(100%-2rem))] sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b bg-white px-4 py-4 pr-12 sm:px-6 sm:pr-14">
          <DialogTitle ref={title} tabIndex={-1} className="text-lg font-semibold outline-none">Tambah SK KGB</DialogTitle>
          <DialogDescription>Lengkapi data pegawai dan dasar KGB. SK Word tersimpan di arsip dan langsung diunduh.</DialogDescription>
        </DialogHeader>
        <KgbForm key={formKey} employees={employees} signatories={signatories} modal={{
          onDirty: () => setDirty(true),
          onCancel: requestClose,
          onSubmittingChange: setSubmitting,
          onSaved: () => { close(); onSaved(); },
        }} />
        <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Buang isian SK KGB?</AlertDialogTitle>
              <AlertDialogDescription>Isian yang belum disimpan akan dihapus saat formulir ditutup.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction variant="destructive" onClick={close}>Buang isian</AlertDialogAction>
              <AlertDialogCancel>Lanjut mengisi</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
