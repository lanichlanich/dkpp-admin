import type { Metadata } from "next";
import { EmployeeDataTable } from "@/components/employees/employee-data-table";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { getEmployeeOptions, getEmployees } from "@/lib/employees";

export const metadata: Metadata = { title: "Daftar Pegawai" };

export default async function EmployeesPage() {
  const [employees, options] = await Promise.all([getEmployees(), getEmployeeOptions()]);
  return (
    <div className="mx-auto max-w-[96rem] space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-indigo-600">Kepegawaian</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Daftar Pegawai</h1><p className="mt-2 text-sm text-zinc-500">Kelola {employees.length} data pegawai. BUP dihitung otomatis dari jenis dan jenjang jabatan.</p></div><EmployeeFormDialog options={options} /></div>
      <EmployeeDataTable data={employees} options={options} />
    </div>
  );
}
