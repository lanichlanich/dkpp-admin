"use client";

import { useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { Building2, CalendarClock, Eye, FileText, IdCard, UserRound } from "lucide-react";
import { EmployeeDocumentsSection } from "@/components/employees/employee-documents-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Employee } from "@/lib/db";
import { formatRetirementAge } from "@/lib/retirement-age";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : `${dateTimeFormatter.format(date)} WIB`;
}

function DetailItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className={mono ? "break-all font-mono text-sm text-zinc-900" : "text-sm leading-6 text-zinc-900"}>{value || "-"}</dd>
    </div>
  );
}

function statusClassName(status: string) {
  if (status === "Aktif") return "bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  if (status === "Mutasi") return "bg-sky-50 text-sky-700 hover:bg-sky-50";
  return "bg-amber-50 text-amber-700 hover:bg-amber-50";
}

export function EmployeeDetailDialog({ employee }: { employee: Employee }) {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("dokumen");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setActiveSection("dokumen");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" aria-label={`Lihat detail ${employee.name}`} />}>
        <Eye className="size-3.5" />
        Detail
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto p-0 sm:max-w-4xl">
        <DialogHeader className="rounded-t-xl border-b bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-5 py-5 pr-12 sm:px-6">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <UserRound className="size-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <DialogTitle className="text-xl leading-7 text-zinc-950">{employee.name}</DialogTitle>
              <DialogDescription className="break-all font-mono text-xs text-zinc-600">NIP {employee.nip}</DialogDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{employee.asnType}</Badge>
                <Badge className={statusClassName(employee.status)}>{employee.status}</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-5 pb-6 sm:px-6">
        <section className="space-y-3" aria-labelledby={`identitas-${employee.nip}`}>
          <div className="flex items-center gap-2 text-zinc-900">
            <IdCard className="size-4 text-indigo-600" />
            <h3 id={`identitas-${employee.nip}`} className="font-semibold">Identitas pegawai</h3>
          </div>
          <dl className="grid gap-px overflow-hidden rounded-xl border bg-zinc-200 sm:grid-cols-2">
            <div className="bg-white p-4">
            <DetailItem label="NIP" value={employee.nip} mono />
            </div>
            <div className="bg-white p-4">
            <DetailItem label="Nama lengkap" value={employee.name} />
            </div>
            <div className="bg-white p-4">
            <DetailItem label="Jenis ASN" value={employee.asnType} />
            </div>
            <div className="bg-white p-4">
            <DetailItem label="Jenis kelamin" value={employee.gender} />
            </div>
            <div className="bg-white p-4">
            <DetailItem label="Status" value={employee.status} />
            </div>
          </dl>
        </section>

        <section className="space-y-4" aria-labelledby={`informasi-lanjutan-${employee.nip}`}>
          <div>
            <h3 id={`informasi-lanjutan-${employee.nip}`} className="font-semibold text-zinc-900">Informasi dan arsip</h3>
            <p className="mt-1 text-xs text-zinc-500">Pilih kategori untuk menampilkan informasi yang dibutuhkan.</p>
          </div>
          <Tabs.Root
            value={activeSection}
            onValueChange={(value) => setActiveSection(String(value))}
            className="min-w-0"
          >
            <Tabs.List className="grid! gap-2 sm:grid-cols-3!" aria-label="Kategori detail pegawai">
              <Tabs.Tab value="dokumen" className="group relative flex min-h-20 items-center gap-3 overflow-hidden rounded-xl border bg-white px-4 py-3 text-left outline-none transition-all hover:border-zinc-300 hover:bg-zinc-50 data-active:border-indigo-200 data-active:bg-indigo-50/70 data-active:shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 transition-colors group-data-active:bg-indigo-600 group-data-active:text-white group-data-active:ring-indigo-600"><FileText className="size-4" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-900">Dokumen</span>
                  <span className="mt-0.5 block text-xs leading-4 text-zinc-500">Kelola arsip pegawai</span>
                </span>
                <span className="absolute inset-x-4 bottom-0 h-0.5 origin-center scale-x-0 rounded-full bg-indigo-600 transition-transform group-data-active:scale-x-100" />
              </Tabs.Tab>
              <Tabs.Tab value="jabatan" className="group relative flex min-h-20 items-center gap-3 overflow-hidden rounded-xl border bg-white px-4 py-3 text-left outline-none transition-all hover:border-zinc-300 hover:bg-zinc-50 data-active:border-indigo-200 data-active:bg-indigo-50/70 data-active:shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors group-data-active:bg-indigo-600 group-data-active:text-white group-data-active:ring-indigo-600"><Building2 className="size-4" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-900">Jabatan</span>
                  <span className="mt-0.5 block text-xs leading-4 text-zinc-500">Posisi dan unit kerja</span>
                </span>
                <span className="absolute inset-x-4 bottom-0 h-0.5 origin-center scale-x-0 rounded-full bg-indigo-600 transition-transform group-data-active:scale-x-100" />
              </Tabs.Tab>
              <Tabs.Tab value="pencatatan" className="group relative flex min-h-20 items-center gap-3 overflow-hidden rounded-xl border bg-white px-4 py-3 text-left outline-none transition-all hover:border-zinc-300 hover:bg-zinc-50 data-active:border-indigo-200 data-active:bg-indigo-50/70 data-active:shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors group-data-active:bg-indigo-600 group-data-active:text-white group-data-active:ring-indigo-600"><CalendarClock className="size-4" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-900">Pencatatan</span>
                  <span className="mt-0.5 block text-xs leading-4 text-zinc-500">Riwayat pembaruan</span>
                </span>
                <span className="absolute inset-x-4 bottom-0 h-0.5 origin-center scale-x-0 rounded-full bg-indigo-600 transition-transform group-data-active:scale-x-100" />
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="dokumen" className="mt-4 rounded-2xl border bg-zinc-50/50 p-4 shadow-sm outline-none sm:p-5">
              <EmployeeDocumentsSection employee={employee} active={open && activeSection === "dokumen"} />
            </Tabs.Panel>

            <Tabs.Panel value="jabatan" className="mt-4 rounded-2xl border bg-white p-5 shadow-sm outline-none sm:p-6">
              <div className="mb-5 flex items-center gap-3 border-b pb-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Building2 className="size-4" /></span>
                <div>
                  <h4 className="font-semibold text-zinc-900">Jabatan dan unit kerja</h4>
                  <p className="mt-0.5 text-xs text-zinc-500">Informasi posisi, golongan, BUP, dan penempatan pegawai.</p>
                </div>
              </div>
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <div className="sm:col-span-2"><DetailItem label="Jabatan" value={employee.position} /></div>
                <DetailItem label="Jenis jabatan" value={employee.positionType} />
                <DetailItem label="Eselon" value={employee.echelon} />
                <DetailItem label="Golongan / pangkat" value={employee.rank} />
                <DetailItem label="Batas Usia Pensiun (BUP)" value={formatRetirementAge(employee.retirementAge)} />
                <div className="sm:col-span-2"><DetailItem label="Unor induk" value={employee.parentUnit} /></div>
                <div className="sm:col-span-2"><DetailItem label="Unor" value={employee.unit} /></div>
              </dl>
            </Tabs.Panel>

            <Tabs.Panel value="pencatatan" className="mt-4 rounded-2xl border bg-white p-5 shadow-sm outline-none sm:p-6">
              <div className="mb-5 flex items-center gap-3 border-b pb-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><CalendarClock className="size-4" /></span>
                <div>
                  <h4 className="font-semibold text-zinc-900">Informasi pencatatan</h4>
                  <p className="mt-0.5 text-xs text-zinc-500">Waktu data dibuat dan terakhir diperbarui.</p>
                </div>
              </div>
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <DetailItem label="Ditambahkan" value={formatDateTime(employee.createdAt)} />
                <DetailItem label="Terakhir diperbarui" value={formatDateTime(employee.updatedAt)} />
              </dl>
            </Tabs.Panel>
          </Tabs.Root>
        </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
