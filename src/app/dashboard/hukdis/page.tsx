import type { Metadata } from "next";
import { CalendarDays, Scale } from "lucide-react";
import { HukdisFormDialog } from "@/components/hukdis/hukdis-form-dialog";
import { HukdisPrintButton } from "@/components/hukdis/print-button";
import { Button } from "@/components/ui/button";
import { getHukdisEmployees } from "@/lib/employees";
import { getHukdisRecords } from "@/lib/hukdis";
import { hukdisSanctions } from "@/lib/hukdis-types";

export const metadata: Metadata = { title: "Daftar Hukdis" };

const months = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HukdisPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; year?: string | string[] }>;
}) {
  const [employees, params] = await Promise.all([getHukdisEmployees(), searchParams]);
  const now = new Date();
  const requestedMonth = Number(scalar(params.month));
  const requestedYear = Number(scalar(params.year));
  const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
    ? requestedMonth
    : now.getMonth() + 1;
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
    ? requestedYear
    : now.getFullYear();
  const period = `${year}-${String(month).padStart(2, "0")}`;
  const records = await getHukdisRecords(period);
  const recordsByNip = new Map(records.map((record) => [record.employeeNip, record]));
  const head = employees.find((employee) => employee.position.startsWith("KEPALA DINAS"));

  return (
    <div className="mx-auto max-w-[110rem] space-y-6">
      <div className="hukdis-screen-header flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-medium text-indigo-600">Administrasi kepegawaian</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Daftar Hukuman Disiplin</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            Isi jenis hukuman dan nomor keputusan per pegawai aktif, lalu cetak dalam format laporan DKPP.
          </p>
        </div>
        <HukdisPrintButton />
      </div>

      <form className="hukdis-screen-controls flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-end" method="get">
        <div className="min-w-48">
          <label htmlFor="hukdis-month" className="mb-1.5 block text-xs font-medium text-zinc-600">Bulan laporan</label>
          <select id="hukdis-month" name="month" defaultValue={month} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40">
            {months.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </select>
        </div>
        <div className="min-w-32">
          <label htmlFor="hukdis-year" className="mb-1.5 block text-xs font-medium text-zinc-600">Tahun</label>
          <input id="hukdis-year" name="year" type="number" min="2000" max="2100" defaultValue={year} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
        </div>
        <Button type="submit" variant="outline"><CalendarDays className="size-4" />Tampilkan periode</Button>
        <div className="sm:ml-auto sm:text-right">
          <p className="text-xs text-zinc-500">Pegawai aktif</p>
          <p className="text-lg font-semibold text-zinc-900">{employees.length} orang · {records.length} terisi</p>
        </div>
      </form>

      <section className="hukdis-print-root overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="hukdis-report-heading hidden">
          <div className="hukdis-report-title">
            <Scale aria-hidden="true" />
            <p>DAFTAR VALIDASI HUKUMAN DISIPLIN PEGAWAI NEGERI SIPIL<br />KABUPATEN INDRAMAYU</p>
          </div>
          <div className="hukdis-report-period">
            <p><span>OPD</span>: DINAS KETAHANAN PANGAN DAN PERTANIAN</p>
            <p><span>BULAN</span>: {months[month - 1]} {year}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="hukdis-table w-full min-w-[1900px] border-collapse text-[10px] text-zinc-950">
            <thead>
              <tr>
                <th rowSpan={3} className="w-10">NO</th>
                <th rowSpan={3} className="w-64">NAMA</th>
                <th rowSpan={3} className="w-44">NIP</th>
                <th rowSpan={3} className="w-[28rem]">Nama Jabatan</th>
                <th colSpan={8}>TINGKAT HUKUMAN DISIPLIN</th>
                <th rowSpan={3} className="w-60">NO./TGL KEPUTUSAN</th>
              </tr>
              <tr>
                <th colSpan={2}>RINGAN</th>
                <th colSpan={3}>SEDANG</th>
                <th colSpan={3}>BERAT</th>
              </tr>
              <tr>
                {hukdisSanctions.map((sanction) => <th key={sanction.code} className="w-24">{sanction.label}</th>)}
              </tr>
              <tr className="hukdis-column-numbers">
                <th>1</th><th>2</th><th></th><th>3</th>
                {Array.from({ length: 9 }, (_, index) => <th key={index}>{index + 4}</th>)}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee, index) => {
                const record = recordsByNip.get(employee.nip);
                return <tr key={employee.nip}>
                  <td className="text-center">{index + 1}</td>
                  <td>{employee.name}</td>
                  <td className="font-mono">{employee.nip}</td>
                  <td>{employee.position}</td>
                  {hukdisSanctions.map((sanction) => <td key={sanction.code} className="text-center">{record?.sanctionCode === sanction.code ? "✓" : "-"}</td>)}
                  <td>
                    <div className="whitespace-pre-line">{record ? `No. ${record.decisionNumber}\n${new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${record.decisionDate}T00:00:00Z`))}` : ""}</div>
                    <div className="hukdis-row-action mt-1.5 flex justify-end">
                      <HukdisFormDialog employee={employee} period={period} record={record} />
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        <div className="hukdis-signature">
          <p>Mengetahui</p>
          <p>KEPALA DINAS KETAHANAN PANGAN DAN PERTANIAN</p>
          <p>KABUPATEN INDRAMAYU</p>
          <div className="hukdis-signature-space" />
          <p className="font-bold">{head?.name ?? "-"}</p>
          <p>NIP. {head?.nip ?? "-"}</p>
        </div>
      </section>
    </div>
  );
}
